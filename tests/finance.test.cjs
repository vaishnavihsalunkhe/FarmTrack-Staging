'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
test('all inline scripts parse (blank-screen regression)', () => {
  assert.ok(scripts.length > 0);
  scripts.forEach((script, i) => assert.doesNotThrow(() => new vm.Script(script, {filename:'inline-'+i+'.js'})));
});
const main = scripts.find(s => s.includes('function expenseRows()'));
assert.ok(main, 'finance functions missing');
const start = main.indexOf('function isSaleExpense(');
const end = main.indexOf('function cropName(', start);
assert.ok(start >= 0 && end > start, 'finance code region not found');
const financeCode = main.slice(start, end);
function calculate(data) {
  const ctx = vm.createContext({db: structuredClone(data), show:()=>{}});
  new vm.Script(financeCode).runInContext(ctx);
  return vm.runInContext('({expenses: expenseRows().length,sales:salesRows().length,cost:total(),revenue:salesTotal()})',ctx);
}
const expense=(amount,extras={})=>({id:'x'+amount,category:'Fertilizer',amount,...extras});
const sale=(amount,extras={})=>({id:'s'+amount,type:'Sale',amount,...extras});
test('empty database totals are zero',()=>assert.deepEqual({...calculate({expenses:[],events:[]})},{expenses:0,sales:0,cost:0,revenue:0}));
test('ordinary expense remains an expense',()=>{const r=calculate({expenses:[expense(1200)],events:[]});assert.equal(r.cost,1200);assert.equal(r.revenue,0)});
test('sale event is revenue, never expense',()=>{const r=calculate({expenses:[],events:[sale(4500)]});assert.equal(r.cost,0);assert.equal(r.revenue,4500)});
test('historical linked sale expense is excluded, not double counted',()=>{const r=calculate({expenses:[expense(4500,{eventId:'s4500',category:'Sale'})],events:[sale(4500)]});assert.equal(r.cost,0);assert.equal(r.revenue,4500);assert.equal(r.sales,1)});
test('legacy unlinked Sale category counts once as revenue',()=>{const r=calculate({expenses:[expense(2200,{category:'Sale'})],events:[]});assert.equal(r.cost,0);assert.equal(r.revenue,2200)});
test('mixed expenses and sales reconcile to net surplus',()=>{const r=calculate({expenses:[expense(2000),expense(400,{id:'transport'}),expense(5000,{eventId:'s5000',category:'Sale'})],events:[sale(5000)]});assert.equal(r.cost,2400);assert.equal(r.revenue,5000);assert.equal(r.revenue-r.cost,2600)});
test('fractional rupee values remain accurate',()=>{const r=calculate({expenses:[expense('12.50')],events:[sale('32.75')]});assert.equal(r.revenue-r.cost,20.25)});
test('editing a sale amount updates revenue calculation',()=>{const data={expenses:[],events:[sale(100)]};assert.equal(calculate(data).revenue,100);data.events[0].amount=120;assert.equal(calculate(data).revenue,120)});
