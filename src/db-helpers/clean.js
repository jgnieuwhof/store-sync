
let clean = async (db) => {
  let collections = await db.listCollections().toArray()
  for(let collection of collections) {
    if (!collection.name.includes("system."))
      await db.dropCollection(collection.name)
  }
}

export default clean
