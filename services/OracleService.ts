import oracledb from 'oracledb'
import { prompt } from '~/utils/commandUtils'
import type { TypeDDL } from '~/types/CopyDBOracleTypes'
import { SHARE_ENV, Worker } from 'worker_threads'

export const createConnection = (
    user: string,
    password: string,
    host: string,
    sid: 'ORCL' | 'XE' | string = 'XE',
    port: number = 1521,
) => {
    return oracledb.getConnection({
        user: user,
        password: password,
        connectString: `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${host})(PORT=${port}))(CONNECT_DATA=(SERVER=DEDICATED)(SID=${sid})))`,
    })
}

export const getUser = (env: 'SOURCE' | 'DESTINATION') => getDBData(env, 'USER')

export const getDBData = (env: 'SOURCE' | 'DESTINATION', envVar: string) =>
    process.env[env + '_DB_' + envVar] ?? prompt(env + ' DB ' + envVar + ': ')

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
        getDBData(env, 'PASSWORD'),
        getDBData(env, 'HOST'),
        getDBData(env, 'SID'),
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

    result.rows?.forEach((row) => {
        // @ts-ignore
        data.push(transformToObjectMetadataAndValues(row, result.metaData))
    })

    return data
}

export const transformToObjectMetadataAndValues = (
    row: any[],
    metaData: oracledb.Metadata<any>,
) => {
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
                table,
            },
        })
        worker.on('message', () => {
            resolve()
        })
        worker.on('error', reject)
        worker.on('exit', (code) => {
            if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`))
        })
    })
}

export const resolveProblemsWithData = async (
    ddl: string,
    destination: oracledb.Connection,
    e: Error,
) => {
    console.log('Trying to resolve: ', ddl, e)

    const table = ddl
        .split(' ADD CONSTRAINT ')[0]
        .replace(`ALTER TABLE "${getUser('SOURCE')}"."`, '')
        .replace('"', '')
    const field = ddl.split(' FOREIGN KEY ("')[1].split('") REFERENCES ')[0]
    const otherTable = ddl.split(` REFERENCES "${getUser('SOURCE')}"."`)[1].split('" ("')[0]
    const otherField = ddl
        .split(` REFERENCES "${getUser('SOURCE')}"."${otherTable}" ("`)[1]
        .split(')"')[0]

    const primaryKey =
        (
            await destination.execute<string[]>(`
                SELECT column_name
                FROM all_cons_columns
                WHERE constraint_name = (SELECT constraint_name
                                         FROM all_constraints
                                         WHERE UPPER(table_name) = UPPER('${table}')
                                           AND CONSTRAINT_TYPE = 'P')`)
        ).rows?.[0].unshift() ?? 'ID'

    const result = await destination?.execute<string[]>(`
        select ${primaryKey}
        from ${table} t
                 left join ${otherTable} as ot on t.${field} = ot.${otherField}
        where ot.${otherField} is null`)

    if (!result?.rows) {
        return
    }

    const ids = result.rows.map((row) => row[0]).join(',')

    await destination.execute(`delete
                               from ${table}
                               where ${primaryKey} in (${ids})`)

    //? todo try to correct the table data and try again
    await destination?.execute(ddl as string).catch((e) => {
        console.log('Error setting ddl: ', ddl, e)
    })
}
