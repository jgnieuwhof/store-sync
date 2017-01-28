
/* global process, require */

import chalk from 'chalk'
import { MongoClient } from 'mongodb'
// import _ from 'lodash'

import Etsy from './connectors/etsy'
import Shopify from './connectors/shopify'
import { productFind, productRemove, productSellOut } from './db-helpers'
import logger from './helpers/logger'

let updateVariantQuantity = ({ sku, updateVariants, dbVariant, otherVariant, name }) => {
  if (!updateVariants[sku]) {
    updateVariants[sku] = {
      updatedBy: [],
      diff: 0,
    }
  }
  let diff = otherVariant.quantity - dbVariant.quantity
  if (diff !== 0) {
    updateVariants[sku] = {
      updatedBy: [ ...updateVariants[sku].updatedBy, name ],
      diff: updateVariants[sku].diff + diff,
    }
  }
}

let sync = async () => {
  try {
    let db = await MongoClient.connect(`mongodb://localhost:27017/storeSync`)
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
      if (mProduct.state === `active`) {
        let dbProduct = await productFind(db, { masterId })
        if (!dbProduct.length) {
          logger.info(`Found a new product: ${mProduct.masterId} : ${mProduct.title}`)
          await db.collection(`products`).insertOne(mProduct)
        }
      }
    }


    /* TODO: Some shitty test code, let's introduce a test suite soon */
    /*/
    slaves[0].products = _.cloneDeep(master.products)
    //delete master.products['505049521']
    delete master.products['505049903']
    master.products['497845627'].state = 'inactive'
    master.products['505051307'].variants['00032'].quantity = 4
    master.products['505053407'].variants['00034'].quantity = 0
    Object.keys(slaves[0].products['505049521'].variants).forEach(sku => {
      slaves[0].products['505049521'].variants[sku].quantity = 0
    })
    delete slaves[0].products['484367950']
    slaves[0].products['505053407'].variants['00034'].quantity = 0
    /*/

    // Iterate all, figure out what the hell we need to do with each product
    let dbProducts = await productFind(db)
    for (let dbProduct of dbProducts) {
      let masterId = dbProduct.masterId
      let mProduct = master.products[masterId]
      let update = {
        db: { delete: false, sellOut: false },
        deleteFrom: [],
        sellOut: [],
        addTo: [],
        variants: {},
      }

      // Have to check for no product at all since etsy sold out listings can't be retrieved (wtf)
      if (!mProduct) {
        update.db.sellOut = true
        for(let slave of slaves) {
          let sProduct = slave.products[masterId]
          if (sProduct && Object.keys(sProduct.variants)
            .find(sku => sProduct.variants[sku].quantity > 0)
          ) {
            update = { ...update, sellOut: [ ...update.sellOut, slave.name ] }
          }
        }
      }
      else if (mProduct.state !== `active`) {
        update.db.delete = true
        for(let slave of slaves) {
          if (slave.products[masterId]) {
            update = { ...update, deleteFrom: [ ...update.deleteFrom, slave.name ] }
          }
        }
      }
      else {
        // Sync up quantities w/ slaves
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

    // use our update object to update our connectors
    for(let masterId of Object.keys(updateTracker)) {
      let update = updateTracker[masterId]
      let dbProduct = (await productFind(db, { masterId }))[0]
      for(let slave of slaves.filter(s => update.deleteFrom.includes(s.name))) {
        await slave.deleteProduct({ masterId })
      }
      for(let slave of slaves.filter(s => update.sellOut.includes(s.name))) {
        await slave.sellOutProduct({ masterId })
      }
      for(let slave of slaves.filter(s => update.addTo.includes(s.name))) {
        await slave.addProduct({ masterId })
      }
      for(let sku of Object.keys(update.variants)) {
        let dbVariant = dbProduct.variants[sku]
        let uVariant = update.variants[sku]
        if (uVariant.diff !== 0) {
          let newQuantity = dbVariant.quantity + uVariant.diff
          if (newQuantity < 0) {
            // Send admin email notifying collision and problem
            logger.info(`product ${masterId} had an oversold sale collision\n`
              + `platforms involved: ${uVariant.updatedBy}`
            )
            newQuantity = 0
          }
          logger.info(`updating ${masterId} with quantity ${newQuantity} in:\n`
            + ` - ${master.name}\n`
            + slaves.map(s => ` - ${s.name}\n`).join(``)
          )
          await master.updateQuantity({ masterId, sku, newQuantity })
          for (let slave of slaves) {
            await slave.updateQuantity({ masterId, sku, newQuantity })
          }
        }
      }
    }

    // update our db using our update object
    for (let masterId of Object.keys(updateTracker)) {
      let { db: dbUpdate } = updateTracker[masterId]
      if (dbUpdate.delete) {
        logger.info(`product ${masterId} deleted`)
        await productRemove(db, { masterId })
      }
      else if (dbUpdate.sellOut) {
        logger.info(`product ${masterId} sold out`)
        await productSellOut(db, { masterId })
      }
    }
  }
  catch(e) {
    logger.info(chalk.red(`Error in sync: `, e, e.stack))
  }
}

let main = async () => {
  logger.info(`starting sync`)
  await sync()
  logger.info(`sync finished, exiting`)
  process.exit()
}

main()
