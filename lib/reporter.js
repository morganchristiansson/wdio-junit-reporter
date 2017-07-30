import events from 'events'
import junit from 'junit-report-builder'
import path from 'path'
import fs from 'fs'
import mkdirp from 'mkdirp'

/**
 * Initialize a new `Junit` test reporter.
 *
 * @param {Runner} runner
 * @api public
 */
class JunitReporter extends events.EventEmitter {
    constructor (baseReporter, config, options = {}) {
        super()

        this.baseReporter = baseReporter
        this.config = config
        this.options = options
        this.options.outputDir = path.resolve(this.options.outputDir)
        this.suiteNames = {}
        mkdirp.sync(this.options.outputDir)
        this.suiteNameRegEx = this.options.suiteNameFormat instanceof RegExp
            ? this.options.suiteNameFormat
            : /[^a-z0-9]+/

        this.on('end', ::this.onEnd)
    }

    onEnd () {
        const { epilogue } = this.baseReporter
        for (let cid of Object.keys(this.baseReporter.stats.runners)) {
            const capabilities = this.baseReporter.stats.runners[cid]
            this.prepareXml(capabilities)
        }
        epilogue.call(this.baseReporter)
    }

    prepareName (name = 'Skipped test') {
        return name.toLowerCase().split(this.suiteNameRegEx).filter(
            (item) => item && item.length
        ).join('_')
    }

    prepareXml (capabilities) {
        const packageName = this.options.packageName
            ? `${capabilities.sanitizedCapabilities}-${this.options.packageName}`
            : capabilities.sanitizedCapabilities

        for (let specId of Object.keys(capabilities.specs)) {
            const spec = capabilities.specs[specId]

            for (let suiteKey of Object.keys(spec.suites)) {
                /**
                 * ignore root before all
                 */
                /* istanbul ignore if  */
                if (suiteKey.match(/^"before all"/)) {
                    continue
                }

                const suite = spec.suites[suiteKey]

                let suiteName = this.prepareName(suite.title)
                // Add -suffix to suiteName to avoid overwriting existing results from same run
                const suiteNameReal = suiteName
                this.suiteNames[suiteNameReal] = this.suiteNames[suiteNameReal] || 0
                if (this.suiteNames[suiteNameReal]) {
                    suiteName = suiteNameReal + '-' + this.suiteNames[suiteNameReal]
                }
                this.suiteNames[suiteNameReal]++

                const builder = junit.newBuilder()
                const testSuite = builder.testSuite()
                    .name(suiteName)
                    .timestamp(suite.start)
                    .time(suite.duration / 1000)
                    .property('specId', specId)
                    .property('suiteName', suite.title)
                    .property('capabilities', capabilities.sanitizedCapabilities)
                    .property('file', spec.files[0].replace(process.cwd(), '.'))

                for (let testKey of Object.keys(suite.tests)) {
                    if (testKey !== 'undefined') { // fix cucumber hooks crashing reporter
                        const test = suite.tests[testKey]
                        const testName = this.prepareName(test.title)

                        const testCase = testSuite.testCase()
                            .className(`${packageName}.${suiteName}`)
                            .name(testName)
                            .time(test.duration / 1000)

                        if (test.state === 'pending') {
                            testCase.skipped()
                        }

                        if (test.error) {
                            testCase.error(test.error.message)
                            testCase.standardError(`\n${test.error.stack}\n`)
                        }

                        const output = this.getStandardOutput(test)
                        if (output) testCase.standardOutput(`\n${output}\n`)
                    }
                }
                const fileName = `${packageName}.${suiteName}.xml`.replace(/\//g, '_')
                const filePath = path.join(this.options.outputDir, fileName)
                console.log(fileName)
                const xml = builder.build()
                // console.log(xml)
                fs.writeFileSync(filePath, xml)
            }
        }
        // return builder.build()
    }

    getStandardOutput (test) {
        /* istanbul ignore if  */
        if (this.options.writeStandardOutput === false) {
            return ''
        }
        let standardOutput = []
        test.output.forEach((data) => {
            switch (data.type) {
            case 'command':
                standardOutput.push(
                    `COMMAND: ${data.payload.method.toUpperCase()} ` +
                    `${data.payload.uri.href} - ${this.format(data.payload.data)}`
                )
                break
            case 'result':
                standardOutput.push(`RESULT: ${this.format(data.payload.body)}`)
                break
            }
        })
        return standardOutput.length ? standardOutput.join('\n') : ''
    }

    format (val) {
        return JSON.stringify(this.baseReporter.limit(val))
    }
}

export default JunitReporter
