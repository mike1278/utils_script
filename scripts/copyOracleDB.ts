import oracledb from 'oracledb'
import type {CommandArgs, WhatCopy} from '~/types/CopyDBOracleTypes'
import {
    connectTo,
    getDDL,
    getUser,
    removeForeignKeysFromDDLTable,
    runCopyDataTableWorker
} from '~/services/OracleService'
import {chunks} from "~/utils/arrayUtils"

let source: null | oracledb.Connection = null
let destination: null | oracledb.Connection = null

// cache of the tables list for later use when copying the data
let tables: string[] = []

const tablesToExclude = (process.env.TABLES_TO_IGNORE?.split(','))?.filter(t => t.trim() != '') ?? []
const onlyTables = (process.env.ONLY_SOME_TABLES?.split(','))?.filter(t => t.trim() != '') ?? []

const copyTables = async () => {
    if (!source) {
        throw new Error('source is not defined')
    }

    await removeForeignKeysFromDDLTable(source)
    await executeDDL(await getDDL(source, 'TABLE'))
        .catch(e => {
            console.log('Error setting ddl for table ', e)
        })
    console.log('Done copying collections');
}

const executeDDL = async (resultDDL: oracledb.Result<string[]>) => {
    if (!resultDDL.rows) {
        return
    }

    for (const row of resultDDL.rows) {
        const ddl = row[0]

        await destination?.execute(ddl as string)
            .catch(e => {
                console.log('Error setting ddl: ', ddl, e)
            })
    }
}

const copySequences = async () => {
    if (!source) {
        throw new Error('source is not defined')
    }

    await executeDDL(await getDDL(source, 'SEQUENCE'))
        .catch(e => {
            console.log('Error setting ddl for sequence ', e)
        })
}

const addingForeignKeys = async () => {
    if (!source) {
        throw new Error('source is not defined')
    }

    await executeDDL(await getDDL(source, 'REF_CONSTRAINT'))
}

const copyData = async () => {
    const errorTables: string[] = []
    console.log('Tables to ignore: ' + tablesToExclude.length)
    for (const chunk of chunks(tables, 100)) {
        console.log(chunk.join(','))
        await Promise.all(chunk.map(async (table) =>
            await runCopyDataTableWorker(table)
                .catch(e => {
                    console.log(e)
                    errorTables.push(table)
                }))
        )
    }

    if (errorTables.length > 0) {
        console.error('Error copy this tables: ', errorTables)
    }

    console.log('Done copying all data')
}

const loadTables = async () => {
    const tablesResults = await source?.execute<string[]>(`
        SELECT TABLE_NAME
        FROM all_tables
        where OWNER = '${getUser('SOURCE')}'
    `)

    if (!tablesResults || !tablesResults.rows) {
        throw new Error('Could not load tables')
    }

    tables = tablesResults.rows.map(result => result[0])
        .filter(table => {
            return !tablesToExclude.includes(table) || (onlyTables.length > 0 && onlyTables.includes(table))
        })

}


export const alias = 'copyDB'

export default async (args: CommandArgs) => {
    destination = await connectTo('DESTINATION')
    source = await connectTo('SOURCE')
    oracledb.fetchAsString = [oracledb.CLOB]
    console.time('Copying database!')
    const executeOnly = (process.env.COPY?.split(',') ?? []) as WhatCopy[]

    try {
        console.time('Search tables')
        await loadTables()
        console.timeEnd('Search tables')

        if (executeOnly.includes('sequence')) {
            console.time('Copy sequences')
            await copySequences()
            console.timeEnd('Copy sequences')
        }

        if (executeOnly.includes('table')) {
            console.time('Copy tables')
            await copyTables()
            console.timeEnd('Copy tables')
        }

        if (executeOnly.includes('data')) {
            console.time('Copy data')
            await copyData()
            console.timeEnd('Copy data')
        }

        if (executeOnly.includes('foreign')) {
            console.time('Adding foreign keys')
            await addingForeignKeys()
            console.timeEnd('Adding foreign keys')
        }

    } catch (e) {
        throw e
    } finally {
        source?.close()
        destination?.close()

        console.timeEnd('Copying database!')
    }
}