
import { MongoClient } from 'mongodb'

import clean from '../../src/db-helpers/clean'

export default async () => {
  let db = await MongoClient.connect(`mongodb://localhost:27017/storeSyncTest`)
  await clean(db)
  return db
}
