import * as fs from 'fs'
import {parse} from "csv-parse"
import {createObjectCsvWriter} from "csv-writer"

const readCsv = <T = any>(file: string, delimiter = ';'): Promise<T[]> => {
    return new Promise((resolve, reject) => {
        let result: T[] = []

        fs.createReadStream(file)
            .pipe(parse({
                delimiter: delimiter, quote: false, columns: true,
                trim: true,
                cast: (value, context) => {
                    if (context.header) return value.toLowerCase();
                    return String(value);
                },
            }))
            .on("data", (row) => {
                result.push(row)
            })
            .on("end", () => {
                console.log("finished");
                resolve(result)
            })
            .on("error", (error) => {
                console.log("Error message", error.message);
                reject(error)
            })
    })
}

const writeCsv = (data: any[], file: string) => {
    if (data.length == 0)
        return

    return createObjectCsvWriter({
        path: file,
        header: Object.keys(data[0]).map(name => ({id: name, title: name}))
    })
        .writeRecords(data)
        .then(() => console.info('The CSV file was written successfully'))
        .catch(e => console.error('Error writing csv: ', e))
}


export {readCsv, writeCsv}