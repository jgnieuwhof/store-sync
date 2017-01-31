
import { expect } from 'chai'
import td from 'testdouble'

import Syncer from '../src/Syncer'
import dbInit from './helpers/dbInit'

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
  let db

  before(async () => {
    db = await dbInit()
  })

  describe(`#initialize`, () => {
    it(`should set up its member variables`, () => {
      let syncer = new Syncer()
      let master = { hi: `hi` }
      let slaves = [ { bye: `bye` } ]
      syncer.initialize({ db, master, slaves })
      expect(syncer.db).to.equal(db)
      expect(syncer.master).to.equal(master)
      expect(syncer.slaves).to.equal(slaves)
    })
  })

  describe(`#sync`, async () => {
    it(`should only add new products if found`, async () => {
      let master = {
        name: `master`,
        products: {
          '12345': {
            masterId: '12345',
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
      let slave = {
        name: `slave`,
        products: {},
        fetchProducts: td.function(`.fetchProducts`),
        addProduct: td.function(`.addProduct`),
      }
      let syncer = new Syncer()
      await syncer.initialize({ db, master, slaves: [ slave ] })
      await syncer.sync()
      td.verify(master.fetchProducts())
      td.verify(slave.addProduct(master.products['12345']))
    })
  })
})
