
let findProduct = async (db, params = {}) => {
  let cursor = await db.collection(`products`).find(params)
  let products = await cursor.toArray()
  return products
}

export default findProduct
