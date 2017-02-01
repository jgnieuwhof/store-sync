
import { expect } from 'chai'
import td from 'testdouble'

import Syncer from '../src/Syncer'
import dbInit from './helpers/dbInit'
import cleanDbObject from './helpers/cleanDbObject'
import { productFind } from '../src/db-helpers'

// TODO: Some shitty test code, let's introduce a test suite soon
// this.slaves[0].products = _.cloneDeep(this.master.products)
// //delete this.master.products['505049521']
// delete this.master.products['505049903']
// this.master.products['497845627'].state = 'inactive'
// this.master.products['505051307'].variants['00032'].quantity = 4
// this.master.products['505053407'].variants['00034'].quantity = 0
// Object.keys(this.slaves[0].products['505049521'].variants).forEach(sku => {
//   this.slaves[0].products['505049521'].variants[sku].quantity = 0
// })
// delete this.slaves[0].products['484367950']
// this.slaves[0].products['505053407'].variants['00034'].quantity = 0

describe(`Syncer`, () => {
  let db, master, slaves, syncer

  before(async () => {
    db = await dbInit()
    master = {
      name: `master`,
      products: {
        '1': {
          masterId: '1',
          state: `active`,
          title: `first product fake title`,
          variants: {
            '001': {
              sku: '001',
              quantity: 10,
            },
          },
        },
      },
      fetchProducts: td.function(`.fetchProducts`),
    }
    slaves = [{
      name: `slave`,
      products: {},
      fetchProducts: td.function(`.fetchProducts`),
      addProduct: td.function(`.addProduct`),
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
      td.verify(slaves[0].addProduct(master.products['1']))
    })

    it(`should add new products to the database tracker`, async () => {
      let product1, product2
      let products = await productFind(db)
      expect(products.length).to.equal(1)
      product1 = cleanDbObject(products.find(p => p.masterId === `1`))
      product2 = cleanDbObject(master.products[`1`])
      expect(product1).to.eql(product2)
    })
  })
})
