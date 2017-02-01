
import _ from 'lodash'

export default (obj) => {
  return _.omit(obj, [`_id`, `_bsonType`])
}
