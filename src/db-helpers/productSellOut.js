
let sellOutProduct = async (db, { masterId }) => {
  let query = {
    masterId,
    variants: {
      $elemMatch: {
        quantity: { $ne: 0 },
      },
    },
  }

  while (true) {
    let cursor = await db.collection(`products`).find(query)
    let products = await cursor.toArray()
    if (!products.length)
      break
    await db.collection(`products`).update(
      query,
      { $set: { "variants.$.quantity": 0 } },
      { multi: true }
    )
  }
}

export default sellOutProduct
