import minimist from 'minimist'
import oracledb from 'oracledb'
import {removeNullUndefined} from "~/utils/objectUtils";

let source: null | oracledb.Connection = null
let destination: null | oracledb.Connection = null

// cache of the tables list for later use when copying the data
let tables: string[] = [];

const tablesToExclude = (process.env.TABLES_TO_IGNORE?.split(','))?.filter(t => t.trim() != '') ?? []
const onlyTables = (process.env.ONLY_SOME_TABLES?.split(','))?.filter(t => t.trim() != '') ?? []

async function copyTables() {
    // todo futurely we can get this from the source
    console.log('Done copying collections');
}

async function copyIndexes() {
    // todo futurely we can get this from the source

    console.log('Done copying indexes');
}

async function copyFunctions() {
    // todo futurely we can get this from the source
    console.log('Done copying functions');
}

const copyDataTable = async (table: string) => {
    console.log('Copying data from ' + table)

    let page = 0

    do {
        const result = await source
            ?.execute(`select *
                       from ${table} OFFSET ${page * 500} ROWS FETCH NEXT 500 ROWS ONLY`)

        if (!result?.rows) {
            break
        }

        const rows: any[] = result.rows


        for (const row of rows) {
            // @ts-ignore
            let data = transformToObjectMetadataAndValues(row, result.metaData)

            data = removeNullUndefined(data)
            const fields = Object.keys(data).map(field => field).join(', ') ?? ''
            const values = Object.keys(data).map(field => ':' + field).join(', ') ?? ''

            try {
                await destination?.execute(`
                        begin
                            INSERT INTO ${table} (${fields}) VALUES (${values});
                        exception
                            when dup_val_on_index then null;
                        end;
                    `, data)
            } catch (e) {
                throw e
            }

        }

        destination?.commit()

        if (result?.rows.length < 500 || page > 4) {
            break
        }
        page++
    } while (true)
}

const copyData = async () => {
    console.log('Tables to ignore: ' + tablesToExclude.length)
    for (const table of tables) {
        if (tablesToExclude.includes(table) || (onlyTables.length > 0 && !onlyTables.includes(table))) {
            continue
        }

        await copyDataTable(table)
    }

    console.log('Done copying all data')
}

const loadTables = async () => {
    const tablesResults = await destination?.execute<string[]>('SELECT TABLE_NAME FROM all_tables where TABLESPACE_NAME = \'USERS\'')

    if (!tablesResults) {
        throw new Error('Could not load tables')
    }

    tables = tablesResults.rows?.map(result => result[0]) ?? []
}

const transformResultsInObjects = <T = object>(result: oracledb.Result<any>): T[] => {
    if (!result.metaData) {
        throw new Error('Not valid metadata')
    }

    const data: T[] = []

    result.rows?.forEach(row => {
        // @ts-ignore
        data.push(transformToObjectMetadataAndValues(row, result.metaData))
    })

    return data
}

const transformToObjectMetadataAndValues = (row: any[], metaData: oracledb.Metadata<unknown>) => {
    const obj: any = {}
    row.forEach((value: any, index: number) => {
        // @ts-ignore
        obj[metaData[index].name] = value
    })
    return obj
}

export const alias = 'copyDB'

export default async (args: CommandArgs) => {
    destination = await oracledb.getConnection({
        user: 'BCCWMPOWN',
        password: 'BCCWMPOWN',
        connectString: "(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=localhost)(PORT=1521))(CONNECT_DATA=(SERVER=DEDICATED)(SID=XE)))"
    })

    source = await oracledb.getConnection({
        user: 'BCCWMPOWN',
        password: 'BCCWMPOWN',
        connectString: "(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=rep-test.i.openreply.eu)(PORT=1521))(CONNECT_DATA=(SERVER=DEDICATED)(SID=ORCL)))"
    })

    await loadTables()
    await copyData()
    // await copyTables()
    // await copyIndexes()
    // await copyFunctions()
    console.log('Done copying database!');
}

interface CommandArgs extends minimist.ParsedArgs {
    example?: string
}