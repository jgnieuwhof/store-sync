
import chalk from 'chalk'
// import _ from 'lodash'

import { productFind, productRemove, productSellOut, productInsertOne } from './db-helpers'
import logger from './helpers/logger'

class Syncer {
  db = null
  master = null
  slaves = []
  updateTracker = {}

  initialize = async ({ db, master, slaves }) => {
    this.db = db
    this.master = master
    this.slaves = slaves
  }

  _fetchProducts = async () => {
    await this.master.fetchProducts()
    for(let i = 0; i < this.slaves.length; i++) {
      await this.slaves[i].fetchProducts()
    }

    // TODO: Some shitty test code, let's introduce a test suite soon
    // this.slaves[0].products = _.cloneDeep(this.master.products)
    // //delete this.master.products['505049521']
    // delete this.master.products['505049903']
    // this.master.products['497845627'].state = 'inactive'
    // this.master.products['505051307'].variants['00032'].quantity = 4
    // this.master.products['505053407'].variants['00034'].quantity = 0
    // Object.keys(this.slaves[0].products['505049521'].variants).forEach(sku => {
    //   this.slaves[0].products['505049521'].variants[sku].quantity = 0
    // })
    // delete this.slaves[0].products['484367950']
    // this.slaves[0].products['505053407'].variants['00034'].quantity = 0
  }

  _addNewProductsToDatabase = async () => {
    for (let masterId of Object.keys(this.master.products)) {
      let mProduct = this.master.products[masterId]
      if (mProduct.state === `active`) {
        let dbProduct = await productFind(this.db, { masterId })
        if (!dbProduct.length) {
          logger.info(`Found a new product: ${mProduct.masterId} : ${mProduct.title}`)
          await productInsertOne(this.db, mProduct)
        }
      }
    }
  }

  _updateVariantQuantities = ({ updateVariants, dbProduct, otherProduct, name }) => {
    // Sync up quantities w/ slaves
    for(let sku of Object.keys(dbProduct.variants)) {
      let dbVariant = dbProduct.variants[sku]
      let otherVariant = otherProduct.variants[sku]
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
  }

  _calculateUpdates = async () => {
    // Iterate all, figure out what we need to do with each product
    let dbProducts = await productFind(this.db)
    for (let dbProduct of dbProducts) {
      let masterId = dbProduct.masterId
      let mProduct = this.master.products[masterId]
      let update = {
        db: { delete: false, sellOut: false },
        deleteFrom: [],
        sellOut: [],
        addTo: [],
        variants: {},
      }

      // Have to check for no product at all since etsy sold out listings can't be retrieved
      if (!mProduct) {
        update.db.sellOut = true
        for(let slave of this.slaves) {
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
        for(let slave of this.slaves) {
          if (slave.products[masterId]) {
            update = { ...update, deleteFrom: [ ...update.deleteFrom, slave.name ] }
          }
        }
      }
      else {
        this._updateVariantQuantities({
          updateVariants: update.variants,
          dbProduct,
          otherProduct: mProduct,
          name: this.master.name,
        })
        for (let slave of this.slaves) {
          let sProduct = slave.products[masterId]
          if (!sProduct) {
            update = { ...update, addTo: [ ...update.addTo, slave.name] }
          }
          else {
            this._updateVariantQuantities({
              updateVariants: update.variants,
              dbProduct,
              otherProduct: sProduct,
              name: slave.name,
            })
          }
        }
      }
      this.updateTracker[masterId] = update
    }
  }

  _updateEverything = async () => {
    for(let masterId of Object.keys(this.updateTracker)) {
      let update = this.updateTracker[masterId]
      let dbProduct = (await productFind(this.db, { masterId }))[0]

      for(let slave of this.slaves.filter(s => update.deleteFrom.includes(s.name))) {
        await slave.deleteProduct({ masterId })
      }

      for(let slave of this.slaves.filter(s => update.sellOut.includes(s.name))) {
        await slave.sellOutProduct({ masterId })
      }

      for(let slave of this.slaves.filter(s => update.addTo.includes(s.name))) {
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
            + ` - ${this.master.name}\n`
            + this.slaves.map(s => ` - ${s.name}\n`).join(``)
          )
          await this.master.updateQuantity({ masterId, sku, newQuantity })
          for (let slave of this.slaves) {
            await slave.updateQuantity({ masterId, sku, newQuantity })
          }
        }
      }

      if (update.db.delete) {
        logger.info(`product ${masterId} deleted`)
        await productRemove(this.db, { masterId })
      }
      else if (update.db.sellOut) {
        logger.info(`product ${masterId} sold out`)
        await productSellOut(this.db, { masterId })
      }
    }
  }

  sync = async () => {
    try {
      await this._fetchProducts()
      await this._addNewProductsToDatabase()
      await this._calculateUpdates()
      await this._updateEverything()
    }
    catch(e) {
      logger.info(chalk.red(`Error in sync: `, e, e.stack))
    }
  }
}

export default Syncer
