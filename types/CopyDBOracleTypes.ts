import minimist from "minimist"

export interface Table {
    name: string,
    constrains: {
        table: string,
        name: string
    }[]
}

export interface Constraint {
    CONSTRAINT_TYPE: 'R'
    TABLE_NAME: string
    CONSTRAINT_NAME: string
}

export interface Sequence {
    SEQUENCE_NAME: string
}

export type TypeDDL = 'TABLE' | 'SEQUENCE' | 'CONSTRAINT' | 'REF_CONSTRAINT'
export type WhatCopy = 'sequence' | 'table' | 'data' | 'foreign'

export interface CommandArgs extends minimist.ParsedArgs {

}