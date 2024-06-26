import { connectTo, transformToObjectMetadataAndValues } from '~/services/OracleService.ts'
import { removeNullUndefined } from '~/utils/objectUtils.ts'
import { parentPort, workerData } from 'worker_threads'
import oracledb from 'oracledb'

const copyData = async (table: string) => {
    oracledb.fetchAsString = [oracledb.CLOB]
    const destination = await connectTo('DESTINATION')
    const source = await connectTo('SOURCE')
    const limit = (process.env['DB_PAGE_LIMIT'] ?? null) as number | null

    console.time('Table: ' + table)

    let page = 0

    do {
        const result = await source?.execute<string[]>(`
            select *
            from ${table} OFFSET ${page * 500} ROWS FETCH NEXT 500 ROWS ONLY`)

        if (!result?.rows || !result.metaData) {
            break
        }

        const rows = result.rows

        for (const row of rows) {
            // @ts-ignore
            let data = transformToObjectMetadataAndValues(row, result.metaData)

            data = removeNullUndefined(data)

            const fields =
                Object.keys(data)
                    .map((field) => field)
                    .join(', ') ?? ''
            const values =
                Object.keys(data)
                    .map((field) => ':' + field)
                    .join(', ') ?? ''

            try {
                await destination?.execute(
                    `
                        begin
                            INSERT INTO ${table} (${fields}) VALUES (${values});
                        exception
                            when dup_val_on_index then null;
                        end;
                    `,
                    data,
                )
            } catch (e) {
                throw e
            }
        }

        destination?.commit()

        if (result?.rows.length < 500 || (limit && page > limit)) {
            break
        }

        page++
    } while (true)

    await destination.close()
    await source.close()

    console.timeEnd('Table: ' + table)

    parentPort?.postMessage('done')
}

copyData(workerData.table)
    .then(() => process.exit())
    .catch((e) => {
        throw e
    })
