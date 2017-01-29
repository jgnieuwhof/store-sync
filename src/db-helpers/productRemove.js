
let productRemove = async (db, params = {}) => {
  await db.collection(`products`).remove(params)
}

export default productRemove
