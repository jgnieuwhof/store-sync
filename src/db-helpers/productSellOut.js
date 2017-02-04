
let sellOutProduct = async (db, { masterId }) => {
  let cursor = await db.collection(`products`).find({ masterId })
  let products = await cursor.toArray()
  if (products.length) {
    let variants = products[0].variants
    for(let sku of Object.keys(variants)) {
      variants[sku] = { ...variants[sku], quantity: 0 }
    }
    await db.collection(`products`).update({ masterId },
      { $set: { variants } },
    )
  }
}

export default sellOutProduct
