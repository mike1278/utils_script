import oracledb from "oracledb"
import {prompt} from "~/utils/commandUtils"
import type {TypeDDL} from "~/types/CopyDBOracleTypes"
import {SHARE_ENV, Worker} from "worker_threads"

export const createConnection = (
    user: string, password: string, host: string, sid: 'ORCL' | 'XE' | string = 'XE', port: number = 1521
) => {
    return oracledb.getConnection({
        user: user,
        password: password,
        connectString: `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${host})(PORT=${port}))(CONNECT_DATA=(SERVER=DEDICATED)(SID=${sid})))`
    })
}

export const getUser = (env: 'SOURCE' | 'DESTINATION') => process.env[env + '_DB_USER'] ?? prompt(env.toLowerCase() + ' DB User: ')

export const getDDL = (source: oracledb.Connection, ddl: TypeDDL) => {
    let from: string | null = null
    let fieldName: string | null = null

    switch (ddl) {
        case 'TABLE':
            from = `all_tables t where t.OWNER = '${getUser('SOURCE')}'`
            fieldName = 'TABLE_NAME'
            break
        case 'SEQUENCE':
            from = `all_sequences s where s.SEQUENCE_OWNER = '${getUser('SOURCE')}'`
            fieldName = 'SEQUENCE_NAME'
            break
        case 'REF_CONSTRAINT':
            from = `user_constraints c where c.constraint_type = 'R' and c.OWNER = '${getUser('SOURCE')}'`
            fieldName = 'CONSTRAINT_NAME'
            break
    }

    return source.execute<string[]>(`
        SELECT dbms_metadata.get_ddl('${ddl}', ${fieldName})
        FROM ${from}
    `)
}

export const connectTo = (env: 'SOURCE' | 'DESTINATION') => {
    return createConnection(
        getUser(env),
        process.env[env + '_DB_PASSWORD'] ?? prompt(env.toLowerCase() + ' DB Password: '),
        process.env[env + '_DB_HOST'] ?? prompt(env.toLowerCase() + ' DB Host: '),
        process.env[env + '_DB_SID'] ?? prompt(env.toLowerCase() + ' DB sid: ')
    )
}

export const removeForeignKeysFromDDLTable = async (source: oracledb.Connection) => {
    await source.execute(`
        BEGIN
            DBMS_METADATA.set_transform_param (DBMS_METADATA.session_transform, 'SQLTERMINATOR', false);
            DBMS_METADATA.set_transform_param (DBMS_METADATA.session_transform, 'PRETTY', false);
            DBMS_METADATA.set_transform_param(DBMS_METADATA.session_transform, 'REF_CONSTRAINTS',false);
        END;
    `)
}

export const transformResultsInObjects = <T = object>(result: oracledb.Result<any>): T[] => {
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

export const transformToObjectMetadataAndValues = (row: any[], metaData: oracledb.Metadata<unknown>) => {
    const obj: any = {}
    row.forEach((value: any, index: number) => {
        // @ts-ignore
        obj[metaData[index].name] = value
    })
    return obj
}

export const runCopyDataTableWorker = (table: string) => {
    return new Promise<void>((resolve, reject) => {
        const worker = new Worker('./services/CopyDataWorker.ts', {
            env: SHARE_ENV,
            workerData: {
                table
            }
        })
        worker.on('message', () => {
            resolve()
        })
        worker.on('error', reject)
        worker.on('exit', (code) => {
            if (code !== 0)
                reject(new Error(`Worker stopped with exit code ${code}`))
        })
    })
}