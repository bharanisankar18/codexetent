#!/usr/bin/env python3
"""
Minimal stand-in for the `sqlite3` command-line shell (TEST USE ONLY).
Judge0 runs SQL with the sqlite3 CLI; this script mimics the parts Codextent relies on:
  .headers on|off, .mode list, statements run in order, list output "a|b", NULL as empty,
  errors printed to stderr and the run continues, exit code 1 if anything failed.
Usage: python3 sqlite_cli.py script.sql
"""
import sqlite3
import sys


def fmt(v):
    if v is None:
        return ''
    if isinstance(v, float) and v.is_integer() and abs(v) < 1e15:
        return repr(v)  # 3.0 like the CLI
    return str(v)


def main(path):
    conn = sqlite3.connect(':memory:')
    headers = False
    buf = ''
    failed = False
    with open(path, encoding='utf-8') as f:
        lines = f.read().split('\n')
    for line in lines:
        if not buf.strip() and line.strip().startswith('.'):
            parts = line.strip().split()
            if parts[0] == '.headers' and len(parts) > 1:
                headers = parts[1].lower() == 'on'
            continue
        buf += line + '\n'
        if sqlite3.complete_statement(buf):
            stmt, buf = buf, ''
            if not stmt.strip():
                continue
            try:
                cur = conn.execute(stmt)
                if cur.description:
                    rows = cur.fetchall()
                    if headers and rows:
                        print('|'.join(d[0] for d in cur.description))
                    for r in rows:
                        print('|'.join(fmt(v) for v in r))
                conn.commit()
            except sqlite3.Error as e:
                failed = True
                print('Error: ' + str(e), file=sys.stderr)
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main(sys.argv[1])
