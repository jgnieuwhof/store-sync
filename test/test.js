
import { expect } from 'chai'
import { MongoClient } from 'mongodb'
import td from 'testdouble'

import clean from '../src/db-helpers/clean'
import Syncer from '../src/Syncer'

describe(`Syncer`, () => {
  let db, master, slaves, syncer

  before(async () => {
    db = await MongoClient.connect(`mongodb://localhost:27017/storeSyncTest`)
    await clean(db)
    master = td.object({
      products: [ { masterId: 10 } ],
    })
    slaves = [
      td.object({
        products: [ { masterId: 11 }],
      }),
    ]
    syncer = new Syncer()
  })

  describe(`#initialize`, () => {
    it(`should set up its member variables`, () => {
      syncer.initialize({ db, master, slaves })
      expect(syncer.db).to.equal(db)
      expect(syncer.master).to.equal(master)
      expect(syncer.slaves).to.equal(slaves)
    })
  })
})
