
import { expect } from 'chai'
import td from 'testdouble'
import u from 'updeep'
import _ from 'lodash'

import Syncer from '../src/Syncer'
import dbInit from './helpers/dbInit'
import cleanDbObject from './helpers/cleanDbObject'
import { productFind, productInsert } from '../src/db-helpers'

let verifyDbProduct = ({ product1, product2 }) => {
  expect(cleanDbObject(product1)).to.eql(cleanDbObject(product2))
}

let getProduct = (id, state, quantities) => {
  let variants = quantities.reduce((obj, quantity, i) => {
    let sku = `${id}-${i+1}`
    obj[sku] = { sku, quantity }
    return obj
  }, {})
  return {
    masterId: id,
    state,
    title: `product-${id}`,
    variants,
  }
}

describe(`Syncer`, () => {
  let db, master, slaves, syncer, products

  before(async () => {
    products = [
      getProduct(`1`, `active`, [10]),
      getProduct(`2`, `active`, [2]),
      getProduct(`3`, `inactive`, [5]),
      getProduct(`4`, `active`, [2, 4, 5, 7]),
      getProduct(`5`, `active`, [1]),
      getProduct(`6`, `active`, [2]),
    ]
    db = await dbInit()
    await productInsert(db, products.slice(1).map(p => _.cloneDeep(p)))
    master = {
      name: `master`,
      products: {
        '1': products[0],
        '2': products[1],
        '3': products[2],
        '4': u({ variants: {
            ['4-2']: { quantity: 3 },
            ['4-3']: { quantity: 6 },
            ['4-4']: { quantity: 8 },
          }}, products[3]),
        '6': u({ variants: {
            ['6-1']: { quantity: 1 },
          }}, products[5]),
      },
      fetchProducts: td.function(`.fetchProducts`),
      updateQuantity: td.function(`.updateQuantity`),
    }
    slaves = [{
      name: `slave`,
      products: {
        '2': products[1],
        '3': u({ state: `active` }, products[2]),
        '4': u({ variants: {
            ['4-1']: { quantity: 1 },
            ['4-4']: { quantity: 6 },
          }}, products[3]),
        '5': products[4],
        '6': u({ variants: {
            ['6-1']: { quantity: 1 },
          }}, products[5]),
      },
      fetchProducts: td.function(`.fetchProducts`),
      addProduct: td.function(`.addProduct`),
      deleteProduct: td.function(`.deleteProduct`),
      updateQuantity: td.function(`.updateQuantity`),
      sellOutProduct: td.function(`.sellOutProduct`),
    }]
    syncer = new Syncer()
  })

  describe(`#initialize`, () => {
    before(async () => {
      await syncer.initialize({ db, master, slaves })
    })

    it(`should set up its member variables`, () => {
      expect(syncer.db).to.equal(db)
      expect(syncer.master).to.equal(master)
      expect(syncer.slaves).to.equal(slaves)
    })
  })

  describe(`#sync`, async () => {
    before(async () => {
      await syncer.initialize({ db, master, slaves })
      await syncer.sync()
    })

    it(`should fetch all master and slave products`, async () => {
      td.verify(master.fetchProducts(), { times: 1 })
      for(let slave of slaves) {
        td.verify(slave.fetchProducts(), { times: 1})
      }
    })

    it(`should add new products to slaves`, async () => {
      td.verify(slaves[0].addProduct(master.products['1']), { times: 1 })
      td.verify(slaves[0].addProduct(td.matchers.anything()), { times: 1 })
    })

    it(`should update master and slave with changed quantities`, async () => {
      let slave = slaves[0] // just to get line length < 100 (shrug)
      td.verify(master.updateQuantity(td.matchers.anything()), { times: 5 })
      td.verify(slave.updateQuantity(td.matchers.anything()), { times: 5 })
      td.verify(master.updateQuantity({ masterId: "4", sku: "4-1", newQuantity: 1 }), { times: 1 })
      td.verify(slave.updateQuantity({ masterId: "4", sku: "4-1", newQuantity: 1 }), { times: 1 })
      td.verify(master.updateQuantity({ masterId: "4", sku: "4-2", newQuantity: 3 }), { times: 1 })
      td.verify(slave.updateQuantity({ masterId: "4", sku: "4-2", newQuantity: 3 }), { times: 1 })
      td.verify(master.updateQuantity({ masterId: "4", sku: "4-3", newQuantity: 6 }), { times: 1 })
      td.verify(slave.updateQuantity({ masterId: "4", sku: "4-3", newQuantity: 6 }), { times: 1 })
      td.verify(master.updateQuantity({ masterId: "4", sku: "4-4", newQuantity: 7 }), { times: 1 })
      td.verify(slave.updateQuantity({ masterId: "4", sku: "4-4", newQuantity: 7 }), { times: 1 })
      td.verify(master.updateQuantity({ masterId: "6", sku: "6-1", newQuantity: 0 }), { times: 1 })
      td.verify(slave.updateQuantity({ masterId: "6", sku: "6-1", newQuantity: 0 }), { times: 1 })
    })

    it(`should sell out products not found in the master`, async () => {
      td.verify(slaves[0].sellOutProduct({ masterId: '5'}), { times: 1 })
      td.verify(slaves[0].sellOutProduct(td.matchers.anything()), { times: 1 })
    })

    it(`should delete inactive products from slaves`, async () => {
      td.verify(slaves[0].deleteProduct({ masterId: `3` }), { times: 1 })
      td.verify(slaves[0].deleteProduct(td.matchers.anything()), { times: 1 })
    })

    it(`should add new products to the database tracker`, async () => {
      let dbProducts = await productFind(db)
      expect(dbProducts.length).to.equal(5)
      verifyDbProduct({
        product1: dbProducts.find(p => p.masterId === `1`),
        product2: master.products[`1`],
      })
      verifyDbProduct({
        product1: dbProducts.find(p => p.masterId === `2`),
        product2: master.products[`2`],
      })
      verifyDbProduct({
        product1: dbProducts.find(p => p.masterId === `4`),
        product2: u({
            variants: {
              ['4-1']: { quantity: 1 },
              ['4-2']: { quantity: 1 },
              ['4-2']: { quantity: 3 },
              ['4-3']: { quantity: 6 },
              ['4-4']: { quantity: 7 },
            },
          }, products.find(p => p.masterId === `4`)),
      })
    })
  })
})
