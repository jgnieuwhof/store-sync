
import { MongoClient } from 'mongodb'

import logger from './helpers/logger'
import Etsy from './connectors/etsy'
import Shopify from './connectors/shopify'
import Syncer from './Syncer'

let main = async () => {
  logger.info(`starting sync`)

  let db = await MongoClient.connect(`mongodb://localhost:27017/storeSync`)
  let etsy = new Etsy()
  let shopify = new Shopify()
  let syncer = new Syncer()
  await syncer.initialize({
    db,
    master: etsy,
    slaves: [ shopify ],
  })
  await syncer.sync()

  logger.info(`sync finished, exiting`)
  process.exit()
}

main()
