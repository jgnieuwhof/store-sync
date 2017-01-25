
/* global process, require */

import chalk from 'chalk'
import { MongoClient } from 'mongodb'
import _ from 'lodash'

import Etsy from './connectors/etsy'
import Shopify from './connectors/shopify'

let updateVariantQuantity = ({ sku, updateVariants, dbVariant, otherVariant, name }) => {
  if (!updateVariants[sku]) {
    updateVariants[sku] = {
      updatedBy: [],
      diff: 0,
    }
  }
  let diff = otherVariant.quantity - dbVariant.quantity
  if (diff != 0) {
    updateVariants[sku] = {
      updatedBy: [ ...updateVariants[sku].updatedBy, name ],
      diff: updateVariants[sku].diff + diff,
    }
  }
}

let sync = async () => {
  try {
    let cursor, db = await MongoClient.connect(`mongodb://localhost:27017/storeSync`)
    let updateTracker = {}
    let master = new Etsy()
    let slaves = [new Shopify()]

    // Get all products
    await master.fetchProducts()
    for(let i = 0; i < slaves.length; i++) {
      await slaves[i].fetchProducts()
    }

    // Import new objects to the database
    for (let masterId of Object.keys(master.products)) {
      let mProduct = master.products[masterId]
      cursor = await db.collection(`products`).find({ masterId: mProduct.masterId })
      let dbProduct = await cursor.toArray();
      if (!dbProduct.length) {
        console.log(`Found a new product: ${mProduct.masterId} : ${mProduct.title}`)
        await db.collection(`products`).insertOne(mProduct)
      }
    }


    /* TODO: Some shitty test code, let's introduce a test suite soon */
    /*
    slaves[0].products = _.cloneDeep(master.products)
    delete master.products['505049521']
    delete master.products['505049903']
    master.products['497845627'].state = 'inactive'
    master.products['505051307'].variants['00032'].quantity = 4
    master.products['505053407'].variants['00034'].quantity = 0
    Object.keys(slaves[0].products['505049521'].variants).forEach(sku => { slaves[0].products['505049521'].variants[sku].quantity = 0 })
    slaves[0].products['505053407'].variants['00034'].quantity = 0
    */

    // Iterate all, figure out what the hell we need to do with each product
    cursor = await db.collection(`products`).find()
    let dbProducts = await cursor.toArray()
    for (let dbProduct of dbProducts) {
      let masterId = dbProduct.masterId
      let mProduct = master.products[masterId]
      let update = {
        deleteFrom: [],
        sellOut: [],
        addTo: [],
        variants: {},
      }

      // Have to check for no product at all since etsy sold out listings can't be retrieved (wtf)
      if (!mProduct) {
        for(let slave of slaves) {
          let sProduct = slave.products[masterId]
          if (sProduct && Object.keys(sProduct.variants).find(sku => sProduct.variants[sku].quantity > 0)) {
            update = { ...update, sellOut: [ ...update.sellOut, slave.name ] }
          }
        }
      }
      else if (mProduct.state !== `active`) {
        for(let slave of slaves) {
          if (slave.products[masterId]) {
            update = { ...update, deleteFrom: [ ...update.deleteFrom, slave.name ] }
          }
        }
      }
      else {
        for(let sku of Object.keys(dbProduct.variants)) {
          updateVariantQuantity({
            sku,
            updateVariants: update.variants,
            dbVariant: dbProduct.variants[sku],
            otherVariant: mProduct.variants[sku],
            name: master.name,
          })
        }
        for (let slave of slaves) {
          let sProduct = slave.products[masterId]
          if (!sProduct) {
            update = { ...update, addTo: [ ...update.addTo, slave.name] }
          }
          else {
            for(let sku of Object.keys(dbProduct.variants)) {
              updateVariantQuantity({
                sku,
                updateVariants: update.variants,
                dbVariant: dbProduct.variants[sku],
                otherVariant: sProduct.variants[sku],
                name: slave.name,
              })
            }
          }
        }
      }
      updateTracker[masterId] = update
    }

    console.log(updateTracker)
    for(let masterId of Object.keys(updateTracker)) {
      for(let sku of Object.keys(updateTracker[masterId].variants)) {
        console.log(updateTracker[masterId].variants[sku])
      }
    }
    process.exit()

    for(let masterId of Object.keys(updateTracker)) {
      let update = updateTracker[masterId]
    }

  }
  catch(e) {
    console.log(chalk.red(`Error in sync: `, e, e.stack))
  }
}

sync()
