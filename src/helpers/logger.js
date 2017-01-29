import winston from 'winston'

let logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      level: `debug`,
      colorize: true,
      timestamp: () => {
        let date = new Date().toISOString().
          replace(/T/, ' ').
          replace(/\..+/, '')
        return `[${date}]`
      },
    }),
  ],
})

export default logger
