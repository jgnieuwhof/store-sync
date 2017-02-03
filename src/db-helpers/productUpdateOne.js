
let productUpdateOne = async (db, filter, update) => {
  return await db.collection(`products`).updateOne(filter, update)
}

export default productUpdateOne
