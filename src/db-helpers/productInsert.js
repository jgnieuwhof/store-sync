
let productInsertOne = async (db, products) => {
  return await db.collection(`products`).insertMany(products)
}

export default productInsertOne
