import logger from './helpers/logger'

import Syncer from './Syncer'

let main = async () => {
  logger.info(`starting sync`)

  let syncer = new Syncer()
  await syncer.sync()

  logger.info(`sync finished, exiting`)
  process.exit()
}

main()
