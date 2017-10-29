// @flow

import deepEqual from 'fast-deep-equal'
import { checkCondition } from 'power-filter/jsnext'
import {
  getNestedValue,
  sortByNotation,
  parseDocumentPath,
  createDocumentPath,
  normalizeUpdateOperation,
} from 'oad-utils/jsnext'
import { retargetToProp } from './retarget-to-prop.js'
import { getObjectsToBeAssigned } from './get-objects-to-be-assigned.js'

import type {
  AddToSetOperator,
  BitOperator,
  CurrentDateOperator,
  DocumentPath,
  IncOperator,
  MaxOperator,
  MinOperator,
  MulOperator,
  PopOperator,
  PullOperator,
  PushModifier,
  PushOperator,
  QueryCondition,
  RenameOperator,
  Restorable,
  RestoreOperator,
  SetOperator,
  UnsetOperator,
  UpdateOperation,
  FindOperation,
} from 'mongolike-operations'

/**
 *
 */
export default class PowerAssign {

  /**
   *
   */
  static assign(obj: Object, uOp: $Subtype<UpdateOperation>): Object {
    let updatedObj: Object = obj
    const operatorNames = Object.keys(uOp)

    for (const operatorName of operatorNames) {
      switch (operatorName) {

        case '$inc':
          updatedObj = this.$inc(updatedObj, uOp.$inc)
          break

        case '$set':
          updatedObj = this.$set(updatedObj, uOp.$set)
          break

        case '$min':
          updatedObj = this.$min(updatedObj, uOp.$min)
          break

        case '$max':
          updatedObj = this.$max(updatedObj, uOp.$max)
          break

        case '$mul':
          updatedObj = this.$mul(updatedObj, uOp.$mul)
          break

        case '$addToSet':
          updatedObj = this.$addToSet(updatedObj, uOp.$addToSet)
          break

        case '$pop':
          updatedObj = this.$pop(updatedObj, uOp.$pop)
          break

        case '$pull':
          updatedObj = this.$pull(updatedObj, uOp.$pull)
          break

        case '$push':
          updatedObj = this.$push(updatedObj, uOp.$push)
          break

        case '$currentDate':
          updatedObj = this.$currentDate(updatedObj, uOp.$currentDate)
          break

        case '$bit':
          updatedObj = this.$bit(updatedObj, uOp.$bit)
          break

        case '$unset':
          updatedObj = this.$unset(updatedObj, uOp.$unset)
          break

        case '$rename':
          updatedObj = this.$rename(updatedObj, uOp.$rename)
          break

        case '$restore':
          // this operation must run at the end of all other opreations
          break

        case '$setOnInsert':
          throw new Error(`The given operator "${operatorName}" is not implemented yet.`)

        default:
          throw new Error(`Invalid operator: "${operatorName}"`)
      }
    }
    if (uOp.$restore != null) {
      updatedObj = this.$restore(obj, updatedObj, uOp.$restore)
    }
    return updatedObj
  }

  /**
   *
   */
  static $set<T: Object>(obj: T, setOp: SetOperator): T {
    let updatedObj = obj
    Object.keys(setOp).forEach(docPath => {
      updatedObj = this.setValue(updatedObj, docPath, setOp[docPath])
    })
    return updatedObj
  }


  /**
   *
   */
  static $inc<T: Object>(obj: T, incOp: IncOperator): T {
    const valuesToSet = {}

    Object.keys(incOp).forEach(docPath => {
      const currentVal = getNestedValue(obj, docPath)
      const inc = incOp[docPath]
      valuesToSet[docPath] = currentVal + inc
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   *
   */
  static $min<T: Object>(obj: T, minOp: MinOperator): T {
    const valuesToSet = {}

    Object.keys(minOp).forEach(docPath => {
      const currentVal = getNestedValue(obj, docPath)
      const newVal = minOp[docPath]
      if (newVal < currentVal) {
        valuesToSet[docPath] = newVal
      }
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   *
   */
  static $max<T: Object>(obj: T, maxOp: MaxOperator): T {
    const valuesToSet = {}

    Object.keys(maxOp).forEach(docPath => {
      const currentVal = getNestedValue(obj, docPath)
      const newVal = maxOp[docPath]
      if (newVal > currentVal) {
        valuesToSet[docPath] = newVal
      }
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   *
   */
  static $mul<T: Object>(obj: T, mulOp: MulOperator): T {
    const valuesToSet = {}

    Object.keys(mulOp).forEach(docPath => {
      const currentNum = getNestedValue(obj, docPath)
      if (currentNum == null) {
        throw Error('operand must not be null')
      }
      valuesToSet[docPath] = currentNum * mulOp[docPath]
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   *
   */
  static $addToSet<T: Object>(obj: T, addToSetOp: AddToSetOperator): T {
    const valuesToSet = {}

    Object.keys(addToSetOp).forEach(docPath => {
      let arr: ?Array<any> = getNestedValue(obj, docPath)
      if (arr == null) {
        arr = [] // If the field is absent, empty array is set.
      }
      if (!Array.isArray(arr)) {
        throw new Error(`"$addToSet" operator must be applied to an array. Dot notation: "${docPath}".`)
      }
      let modifier = addToSetOp[docPath]

      if (modifier.$each == null) {
        modifier = { $each: [modifier] }
      }
      // $FlowIssue(arr-is-Array)
      const newArr = modifier.$each.filter(element => !arr.some(arrEl => deepEqual(arrEl, element)))
      valuesToSet[docPath] = arr.concat(newArr)
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   *
   */
  static $pop<T: Object>(obj: T, popOp: PopOperator): T {
    const valuesToSet = {}

    Object.keys(popOp).forEach(docPath => {
      let arr: ?Array<any> = getNestedValue(obj, docPath).slice()
      if (arr == null) {
        arr = [] // If the field is absent, empty array is set.
      }
      if (!Array.isArray(arr)) {
        throw new Error(`"$push" operator must be applied to an array. Dot notation: "${docPath}".`)
      }
      if (popOp[docPath] === 1) {
        arr.pop()
      } else {
        arr.shift()
      }
      valuesToSet[docPath] = arr
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   *
   */
  static $pull<T: Object>(obj: T, pullOp: PullOperator): T {
    const valuesToSet = {}

    Object.keys(pullOp).forEach(docPath => {
      let arr: ?Array<any> = getNestedValue(obj, docPath)
      if (arr == null) {
        return // If the field is absent, no requests will be executed
      }
      if (!Array.isArray(arr)) {
        throw new Error(`"$pull" operator must be applied to an array. Dot notation: "${docPath}".`)
      }
      const condition = pullOp[docPath]
      valuesToSet[docPath] = arr.filter(val => checkCondition(val, condition) === false)
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   *
   */
  static $push<T: Object>(obj: T, pushOp: PushOperator): T {
    const valuesToSet = {}

    Object.keys(pushOp).forEach(docPath => {
      let arr: ?Array<any> = getNestedValue(obj, docPath)
      if (arr == null) {
        arr = [] // If the field is absent, empty array is set.
      }
      if (!Array.isArray(arr)) {
        throw new Error(`"$push" operator must be applied to an array. Dot notation: "${docPath}".`)
      }
      let modifier: PushModifier = pushOp[docPath]

      // Is type of newVal PushModifier or just the value?
      if (modifier.$each == null) {
        modifier = { $each: [modifier] }
      }

      let position = (modifier.$position != null) ? modifier.$position : arr.length
      let newArr = arr.slice()
      newArr.splice(position, 0, ...modifier.$each)
      if (modifier.$sort != null) {
        newArr = sortByNotation(newArr, modifier.$sort)
      }
      if (modifier.$slice != null) {
        newArr = newArr.slice(0, modifier.$slice)
      }
      valuesToSet[docPath] = newArr
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   *
   */
  static $currentDate<T: Object>(obj: T, curDateOp: CurrentDateOperator): T {
    const valuesToSet = {}

    Object.keys(curDateOp).forEach(docPath => {
      let typeSpecification = curDateOp[docPath]

      if (typeSpecification === true) {
        typeSpecification = { $type: 'date'}
      }
      const now = new Date()
      valuesToSet[docPath] = typeSpecification.$type === 'date' ? now : now.getTime()
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   *
   */
  static $bit<T: Object>(obj: T, bitOp: BitOperator): T {
    const valuesToSet = {}

    Object.keys(bitOp).forEach(docPath => {
      const currentNum = getNestedValue(obj, docPath) || 0 // If the field is absent, 0 is set.
      const logicalOperator = Object.keys(bitOp[docPath])[0]
      // $FlowIssue(return-number)
      const operand: number = bitOp[docPath][logicalOperator]
      switch (logicalOperator) {
        case 'and':
          valuesToSet[docPath] = currentNum & operand
          break
        case 'or':
          valuesToSet[docPath] = currentNum | operand
          break
        case 'xor':
          valuesToSet[docPath] = currentNum ^ operand
          break
      }
    })
    return this.$set(obj, valuesToSet)
  }

  /**
   * Unset the value of the given DocumentPaths.
   * NOTICE: The objects whose property are deleted will be converted into a plain object.
   */
  static $unset(obj: Object, unsetOp: UnsetOperator): Object {

    return Object.keys(unsetOp).reduce((newObj, docPath) => {
      const attrs = parseDocumentPath(docPath)
      const lastAttr = attrs.pop()
      const pathToLast = createDocumentPath(...attrs)
      const lastObj = pathToLast
        ? getNestedValue(newObj, pathToLast)
        : newObj

      let copiedLastObj: Array<any> | Object
      if (Array.isArray(lastObj)) {
        copiedLastObj = lastObj.slice()
        copiedLastObj[lastAttr] = null
      }
      else {
        copiedLastObj = Object.assign({}, lastObj)
        delete copiedLastObj[lastAttr]
      }

      return pathToLast
        ? this.$set(newObj, { [pathToLast]: copiedLastObj })
        : copiedLastObj
    }, obj)
  }

  /**
   * Unset the value of the given DocumentPaths.
   * NOTICE: The objects whose property are renamed will be converted into a plain object.
   */
  static $rename(obj: Object, renameOp: RenameOperator): Object {

    return Object.keys(renameOp).reduce((newObj, docPath) => {
      const attrs = parseDocumentPath(docPath)
      const lastAttr = attrs.pop()
      const pathToLast = createDocumentPath(...attrs)
      const lastObj = pathToLast
        ? getNestedValue(newObj, pathToLast)
        : newObj

      if (Array.isArray(lastObj)) {
        throw Error(`$rename operation cannot be applied to array field: "${pathToLast}".`)
      }

      if (!lastObj.hasOwnProperty(lastAttr)) {
        return newObj
      }

      const copiedLastObj = Object.assign({}, lastObj)
      delete copiedLastObj[lastAttr]

      const newAttr = renameOp[docPath]
      copiedLastObj[newAttr] = lastObj[lastAttr]

      return pathToLast
        ? this.$set(newObj, { [pathToLast]: copiedLastObj })
        : copiedLastObj
    }, obj)
  }

  /**
   *
   */
  static $restore(originalObj: Object, targetObj: Object, restoreOp: RestoreOperator): Object {
    const valuesToSet = {}

    Object.keys(restoreOp).forEach(docPath => {
      const currentValue = getNestedValue(targetObj, docPath)
      if (isPrimitive(currentValue)) {
        valuesToSet[docPath] = currentValue
        return
      }

      let Constructor = restoreOp[docPath]
      if (!Constructor) {
        const originalValue = getNestedValue(originalObj, docPath)
        Constructor = originalValue.constructor
      }
      valuesToSet[docPath] = new Constructor(currentValue)
    })
    return this.$set(targetObj, valuesToSet)
  }

  /**
   *
   */
  static setValue<T: Object>(obj: T, docPath: DocumentPath, value: any): T {
    const revObjsToBeAssigned = getObjectsToBeAssigned(obj, docPath).reverse()
    const revKeys = parseDocumentPath(docPath).reverse()
    // assert(objsToBeAssigned.length === keys.length)
    // $FlowIssue(return-T)
    return revKeys.reduce((newValue, key, i) =>
      // $FlowIssue(reduce-first-argument-type)
      Object.assign({}, revObjsToBeAssigned[i], { [key]: newValue })
    , value)
  }
}

/**
 *
 */
export function assign(obj: Object, uOp: Object): Object {
  return PowerAssign.assign(obj, normalizeUpdateOperation(uOp))
}

/**
 *
 */
export function assignToProp(obj: Object, docPath: DocumentPath, uOp: Object): Object {
  const modifiedOps = retargetToProp(docPath, uOp)
  return assign(obj, modifiedOps)
}

/**
 *
 */
export function assignWithRestoration<T: Restorable>(obj: T, uOp: Object): T {
  const updatedObj = assign(obj, uOp)
  const Constructor = obj.constructor
  return new Constructor(updatedObj) // if Constructor is Object, it's OK!
}

/**
 *
 */
export function assignToPropWithRestoration<T: Restorable>(obj: T, docPath: DocumentPath, uOp: Object): T {
  const updatedObj = assignToProp(obj, docPath, uOp)
  const Constructor = obj.constructor
  return new Constructor(updatedObj) // if Constructor is Object, it's OK!
}

function isPrimitive(value: any): boolean {
  const t = typeof value
  return value == null || (t != 'object' && t != 'function')
}
