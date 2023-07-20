import * as log4js from "log4js"
import { Failure } from "./Failure"

export type NotifierConstructorParams = {
    logger: log4js.Logger
}