import axios from 'axios'
import { Failure } from './types/Failure'
require('dotenv').config()

export class Notifier  {
    
    public async notify(failures: Failure[]): Promise<boolean>  {

        for(let i = 0; i < failures.length; i++) {
            failures[0].notified = true
        }

        return true
    }
}