
let productInsertOne = async (db, one) => {
  return await db.collection(`products`).insertOne(one)
}

export default productInsertOne
