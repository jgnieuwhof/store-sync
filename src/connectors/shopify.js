
import chalk from 'chalk'
import fetch from 'node-fetch'

import logger from '../helpers/logger'
import { shopify as shopifyCreds } from '../../credentials'

class Shopify {
  name = 'Shopify'
  url = `https://${shopifyCreds.apiKey}:${shopifyCreds.password}@${shopifyCreds.shop}.myshopify.com`
  products = {}

  log = (message, level = 'info') => {
    logger.log(level, chalk.green(`${this.name}: ${message}`))
  }

  fetch = async ({ url, options }) => {
    options = !options ? {} : options
    let finalUrl = `${this.url}/${url}`
    let response = await fetch(finalUrl, options)
    if (!response.ok) {
      throw `unable to fetch etsy: ${finalUrl} - ${response.status}::${response.statusText}`
    }
    let obj = await response.json()
    return obj
  }

  deleteProduct = async ({ masterId }) => {
    this.log(`deleteProduct ${masterId}`)
  }

  sellOutProduct = async ({ masterId }) => {
    this.log(`sellOutProduct ${masterId}`)
  }

  addProduct = async ({ masterId }) => {
    this.log(`addProduct ${masterId}`)
  }

  updateQuantity = async ({ masterId, sku, newQuantity }) => {
    this.log(`updateQuantity ${masterId}, ${sku}, ${newQuantity}`)
  }

  fetchProducts = async () => {
    let max = 250
    let page = 1
    let shopifyProducts
    while(!shopifyProducts || shopifyProducts.products.length === max) {
      shopifyProducts = await this.fetch({
        url: `admin/products.json?limit=${max}&page=${page++}`,
      })
      this.log(`received ${shopifyProducts.products.length} for page ${page - 1}`)
      shopifyProducts.products.forEach(product => {
        let finalProduct = {
          masterId: product.variants[0].barcode,
          id: product.id,
          state: product.variants.find(v => v.quantity > 0) ? `active` : `sold_out`,
          title: product.title,
          description: product.body_html,
          variants: product.variants.reduce((obj, variant) => {
            return {
              ...obj,
              [variant.sku]: {
                price: variant.price,
                sku: variant.sku,
                weight: variant.weight,
                weightUnits: variant.weight_unit,
                quantity: parseInt(variant.inventory_quantity),
              },
            }
          }, {}),
        }
        this.products[finalProduct.master_id] = finalProduct
      })
    }
  }
}

export default Shopify
