import fs from 'fs'
import path from 'path'
import rimraf from 'rimraf'
import libxml from 'libxmljs'

import JunitReporter from '../lib/reporter'
import runnersFixture from './fixtures/runners.json'
import cucumberRunnerFixture from './fixtures/cucumberRunner.json'

let reporter = null
const outputDir = path.join(__dirname, 'tmp')
const baseReporter = {
    stats: runnersFixture,
    limit: (text) => text,
    epilogue: () => {}
}

describe('junit reporter', () => {
    describe('xml file', () => {
        before(() => {
            reporter = new JunitReporter(baseReporter, {}, { outputDir })
        })

        after(() => {
            rimraf.sync(outputDir)
        })

        it('should generate a valid xml file', () => {
            reporter.onEnd()
        })

        it('should have generated an output file for each suite', () => {
            fs.readdirSync(outputDir).should.have.length(6)
        })

        describe('content checks', () => {
            let xml = null
            let xmlContent = []

            before(() => {
                xml = fs.readdirSync(outputDir)
                console.log("readdir: "+fs.readdirSync(outputDir))
                xml.forEach((filePath, i) => {
                    xmlContent[i] = fs.readFileSync(path.join(outputDir, filePath), 'utf8')
                })
            })

            it('should have correct file names', () => {
                xml.should.be.deepEqual([
                    'phantomjs.1_some_foobar_test.xml',
                    'phantomjs.1_some_other_foobar_test.xml',
                    'phantomjs.1_some_special_spec_title.xml',
                    'phantomjs.some_foobar_test.xml',
                    'phantomjs.some_other_foobar_test.xml',
                    'phantomjs.some_spec_title.xml'
                ])
            })

            it('should be valid xml', () => {
                const xmlDoc1 = libxml.parseXml(xmlContent[1])
                const xmlDoc2 = libxml.parseXml(xmlContent[2])
                xmlDoc1.errors.should.have.length(0)
                xmlDoc2.errors.should.have.length(0)
            })

            it('should have content for skipped test', () => {
                xmlContent[5].should.containEql(
                // eslint-disable-next-line
`    <testcase classname="phantomjs.some_special_spec_title" name="skipped_test" time="1">`)
            })

            it('should have expected content', () => {
                xmlContent[1].should.containEql(
                    '<property name="file" value="/path/to/file.spec.js"/>'
                )
                xmlContent[2].should.containEql(
                    '<property name="file" value="/path/to/file2.spec.js"/>'
                )
                xmlContent[1].should.containEql(
                // eslint-disable-next-line
`    <testcase classname="phantomjs.some_other_foobar_test" name="that_is_a_test" time="1">
      <system-out>
        <![CDATA[
COMMAND: POST /path/to/command - "some payload"
]]>
      </system-out>
    </testcase>`)
                xmlContent[1].should.containEql(
                // eslint-disable-next-line
`    <properties>
      <property name="specId" value="12345"/>
      <property name="suiteName" value="some other foobar test"/>
      <property name="capabilities" value="phantomjs"/>
      <property name="file" value="/path/to/file.spec.js"/>
    </properties>`)

                xmlContent[1].should.containEql(
                // eslint-disable-next-line
`<system-err>
        <![CDATA[
some error stack
with new line
]]>
      </system-err>`
                )
            })
        })
    })

    // describe('outputFileFormat', () => {
    //     let xml1 = null
    //     let xml2 = null

    //     before(() => {
    //         reporter = new JunitReporter(baseReporter, {}, {
    //             outputDir,
    //             outputFileFormat: (opts) => `some-file-${opts.cid}.xml`
    //         })
    //         reporter.onEnd()
    //     })

    //     after(() => {
    //         rimraf.sync(outputDir)
    //     })

    //     it('should have used expected file name format', () => {
    //         [ xml1, xml2 ] = fs.readdirSync(outputDir)
    //         xml1.should.be.equal('some-file-0-0.xml')
    //         xml2.should.be.equal('some-file-0-1.xml')
    //     })
    // })

    describe('suiteNameFormat', () => {
        let xml2Content = null

        before(() => {
            reporter = new JunitReporter(baseReporter, {}, {
                outputDir,
                suiteNameFormat: /[^a-z0-9*]+/
            })
            reporter.onEnd()

            const files = fs.readdirSync(outputDir)
            console.log("files"+files.join('\n'))
            xml2Content = fs.readFileSync(path.join(outputDir, files[2]), 'utf8')
        })

        after(() => {
            rimraf.sync(outputDir)
        })

        it('should include ** in spec title', () => {
            xml2Content.should.containEql('<testsuite name="some_special_**_spec_title"')
        })
    })

    describe('packageName', () => {
        let xml1Content = null

        before(() => {
            reporter = new JunitReporter(baseReporter, {}, {
                outputDir,
                packageName: '____O.o____'
            })
            reporter.onEnd()

            const files = fs.readdirSync(outputDir)
            xml1Content = fs.readFileSync(path.join(outputDir, files[0]), 'utf8')
        })

        after(() => {
            rimraf.sync(outputDir)
        })

        it('should have package name in classname', () => {
            xml1Content.should.containEql('classname="phantomjs-____O.o____.some_foobar_test"')
        })
    })

    describe('cucumber tests', () => {
        before(() => {
            const baseReporterCucumber = {
                stats: cucumberRunnerFixture,
                limit: (text) => text,
                epilogue: () => {}
            }

            reporter = new JunitReporter(baseReporterCucumber, {}, { outputDir })
        })

        after(() => {
            rimraf.sync(outputDir)
        })

        it('should not crash when fed by cucumber', () => {
            reporter.onEnd()
            const files = fs.readdirSync(outputDir)
            files.should.have.lengthOf(2)
        })
    })
})
