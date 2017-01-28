
import chalk from 'chalk'
import request from 'request'

import { etsy as etsyCreds } from '../credentials'
import logger from '../helpers/logger'

class Etsy {
  name = 'Etsy'
  creds = {
    shop: etsyCreds.shop,
    apiKey: etsyCreds.apiKey,
    apiSecret: etsyCreds.apiSecret,
    oauthToken: etsyCreds.oauthToken,
    oauthSecret: etsyCreds.oauthSecret,
  }
  products = {}

  log = (message, level = 'info') => {
    logger.log(level, chalk.blue(`${this.name}: ${message}`))
  }

  fetch = async ({ url }) => {
    let finalUrl = `https://openapi.etsy.com/v2/shops/${this.creds.shop}/${url}`
    let oauth = {
      consumer_key: this.creds.apiKey,
      consumer_secret: this.creds.apiSecret,
      token: this.creds.oauthToken,
      token_secret: this.creds.oauthSecret,
    }
    let response = await new Promise((resolve, reject) => {
      request.get({ url: finalUrl, oauth, json: true }, (e, r, body) => {
        if (r.statusCode !== 200) {
          this.log(body)
          reject(`Could not connect to etsy: ${r.statusCode}::${r.statusMessage}`)
        }
        resolve(body)
      })
    })
    return response
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
    let response, listings

    response = await this.fetch({ url: `listings/active?limit=999999` })
    listings = [...response.results]
    this.log(`${response.count} active etsy listings`)

    response = await this.fetch({ url: `listings/inactive?limit=999999` })
    listings = [...listings, ...response.results]
    this.log(`${response.count} inactive etsy listings`)

    response = await this.fetch({ url: `listings/expired?limit=999999` })
    listings = [...listings, ...response.results]
    this.log(`${response.count} expired etsy listings`)

    listings.forEach(listing => {
      let sku, skuReg = /^\s*#([0-9]+)\s*$/m
      let match = skuReg.exec(listing.description)
      if (!match || !(sku = match[1])) {
        // TODO: Notify admin of error
        this.log(`Could not parse etsy sku out of active listing ${listing.listing_id}`)
        return
      }
      let product = {
        masterId: listing.listing_id.toString(),
        id: listing.listing_id,
        state: listing.state,
        title: listing.title,
        description: listing.description,
        taxonomyPath: listing.taxonomy_path,
        variants: {
          [sku]: {
            sku,
            price: listing.price,
            quantity: parseInt(listing.quantity),
            weight: listing.item_weight,
            weightUnits: listing.item_weight_units,
          },
        },
      }
      this.products[product.masterId] = product
    })
  }
}

export default Etsy
