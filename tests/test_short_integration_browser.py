#!/usr/bin/env python3
"""Offline browser integration checks using server-compatible JSON mocks; no live visits or writes."""
from __future__ import annotations
import argparse
import base64
import json
from pathlib import Path
import shutil
import subprocess
import sys
from urllib.parse import parse_qs, unquote, urlparse
from playwright.sync_api import sync_playwright
from browser_smoke import fixture_page, no_overflow, require
from browser_app import canvas_png, decode_qr, verify_svg
import cairosvg


class TestHarness:
    def __init__(self, context):
        self.context = context
        self.page = None
        self.errors = []

    def open(self):
        if self.page:
            self.page.close()
        self.page = fixture_page(self.context, None, 'https://marincountygov.github.io/marin-links/')
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.evaluate('''() => {
          const original = window.fetch;
          window.__shortCalls = [];
          window.__createdByKey = new Map();
          window.__mockDropNext = false;
          window.__mockUnavailableNext = false;
          window.__mockRateAfter = null;
          window.__mockGlobalDenied = false;
          window.__mockForeignNext = false;
          window.__mockSlowNext = false;
          window.__mockDelayEvery = 0;
          window.__mockCapabilityAnonymous = true;
          window.__mockCapabilityBase = null;
          window.__mockNonCanonicalNext = false;
          window.__mockMalformedSuccessNext = false;
          window.__mockTooLargeNext = false;
          window.__mockDetailMode = 'normal';
          window.__shortInFlight = 0;
          window.__shortMaxInFlight = 0;
          window.fetch = async (url, options = {}) => {
            const address = String(url);
            if (address.endsWith('/s/api/v1/capabilities')) {
              const root = window.MarinLinksTracker.serverRoot;
              const shortBase = window.__mockCapabilityBase || root;
              return new Response(JSON.stringify({data:{application:'Marin Links Server',api_version:'v1',short_url_base_url:shortBase,server_base_url:new URL('s/',root).href,creation:{anonymous_enabled:window.__mockCapabilityAnonymous,key_enabled:false},alias:{min_length:1,max_length:48,reserved:['s'],random_code_length:10}}}),{status:200,headers:{'Content-Type':'application/json'}});
            }
            if (address.includes('/s/api/v1/short-links/') && address.includes('/stats')) {
              if (window.__mockDetailMode === 'suppressed') return new Response(JSON.stringify({data:null,meta:{suppressed:true,minimum_count:5}}),{status:200,headers:{'Content-Type':'application/json'}});
              if (window.__mockDetailMode === 'not_found') return new Response(JSON.stringify({error:{code:'not_found',message:'not found'}}),{status:404,headers:{'Content-Type':'application/json'}});
              if (window.__mockDetailMode === 'error') return new Response('bad gateway',{status:503,headers:{'Content-Type':'text/plain'}});
            }
            if (!(address.includes('/s/api/v1/short-links') && options.method === 'POST')) return original(url, options);
            const payload = JSON.parse(options.body);
            const key = options.headers['Idempotency-Key'];
            const record = { url: address, payload, key, headers: options.headers, credentials: options.credentials, mode: options.mode, cache: options.cache, referrerPolicy: options.referrerPolicy };
            window.__shortCalls.push(record);
            window.__shortInFlight += 1;
            window.__shortMaxInFlight = Math.max(window.__shortMaxInFlight, window.__shortInFlight);
            try {
              if (window.__mockDelayEvery) await new Promise(resolve => setTimeout(resolve, window.__mockDelayEvery));
              if (window.__mockGlobalDenied) return new Response(JSON.stringify({error:{code:'source_not_allowed',message:'source rejected'}}), {status: 403, headers:{'Content-Type':'application/json'}});
              if (window.__mockUnavailableNext) {
                window.__mockUnavailableNext = false;
                return new Response(JSON.stringify({error:{code:'unavailable',message:'later'}}), {status:503,headers:{'Content-Type':'application/json'}});
              }
              if (window.__mockTooLargeNext) {
                window.__mockTooLargeNext = false;
                return new Response(JSON.stringify({error:{code:'request_too_large',message:'too large'}}), {status:413,headers:{'Content-Type':'application/json'}});
              }
              if (payload.destination.includes('/server-rejected')) {
                return new Response(JSON.stringify({error:{code:'destination_not_allowed',message:'blocked'}}), {status:422,headers:{'Content-Type':'application/json'}});
              }
              if (window.__mockRateAfter !== null && window.__shortCalls.length > window.__mockRateAfter) {
                return new Response(JSON.stringify({error:{code:'rate_limit_exceeded',message:'too many'}}), {status:429,headers:{'Content-Type':'application/json','Retry-After':'100'}});
              }
              let created = window.__createdByKey.get(key);
              const replay = Boolean(created);
              if (!created) {
                const sequence = window.__createdByKey.size + 1;
                created = {
                  code: 'test' + String(sequence).padStart(6,'0'),
                  id: sequence.toString(16).padStart(32,'0')
                };
                window.__createdByKey.set(key, created);
              }
              if (window.__mockSlowNext) { window.__mockSlowNext = false; await new Promise(resolve => setTimeout(resolve, 800)); }
              if (window.__mockDropNext) {
                window.__mockDropNext = false;
                throw new TypeError('Simulated response lost');
              }
              let link = new URL(created.code, window.MarinLinksTracker.serverRoot).href;
              if (window.__mockForeignNext) link = 'https://example.invalid/'+created.code;
              if (window.__mockNonCanonicalNext) link = new URL('extra/../'+created.code, window.MarinLinksTracker.serverRoot).toString().replace('/'+created.code, '/extra/../'+created.code);
              window.__mockForeignNext = false;
              window.__mockNonCanonicalNext = false;
              if (window.__mockMalformedSuccessNext) {
                window.__mockMalformedSuccessNext = false;
                return new Response('{not-json', {status:201,headers:{'Content-Type':'application/json'}});
              }
              return new Response(JSON.stringify({data:{id:created.id,code:created.code,short_url:link,status:'active',revision:1,created_at:'2026-10-28T18:00:00Z'}}), {status: replay ? 200 : 201,headers:{'Content-Type':'application/json'}});
            } finally {
              window.__shortInFlight -= 1;
            }
          };
        }''')
        return self.page

    def calls(self):
        return self.page.evaluate('window.__shortCalls')

    def wait(self, ms=480):
        self.page.wait_for_timeout(ms)


def test_long_and_single(h):
    p=h.open()
    p.locator('#destination-url').fill('https://hhs.marincounty.gov/?a=1&a=2#section')
    h.wait()
    long_url=p.locator('#final-url').text_content()
    require(long_url.startswith('https://l.marinhhs.org/?d='), 'Long tracking endpoint is wrong')
    decoded=unquote(long_url.split('?d=',1)[1])
    require('a=1&a=2' in decoded and '#section' in decoded and 'via=link' in decoded,'Long destination parameters were lost')
    require(len(h.calls()) == 0, 'Long preview submitted creation request')
    p.locator('#length-short').check()
    h.wait()
    require(p.locator('#short-create').is_visible() and p.locator('#short-create').is_enabled(), 'Short action unavailable')
    require(p.locator('#final-url').text_content() == '' and p.locator('#copy-link-primary').is_disabled(), 'Short generated before click')
    require(len(h.calls()) == 0, 'Choosing Short made a POST')
    p.locator('#short-create').click()
    p.wait_for_function("() => document.querySelector('#final-url')?.textContent.endsWith('test000001')")
    calls=h.calls()
    require(len(calls)==1, 'Unexpected number of single-link creation requests')
    record=calls[0]
    require(record['url']=='https://l.marinhhs.org/s/api/v1/short-links', 'Creation endpoint differs')
    require(record['credentials']=='omit' and 'Authorization' not in record['headers'] and 'Origin' not in record['headers'], 'Client sent credentials or tried to set Origin')
    require(record['mode']=='cors' and record['cache']=='no-store' and record['referrerPolicy']=='no-referrer', 'Creation fetch safety options differ')
    require(record['headers'].get('Content-Type')=='application/json' and record['headers'].get('Accept')=='application/json', 'Creation headers differ')
    require(record['payload']['source_path']=='/marin-links/' and record['payload']['alias'] is None, 'Incorrect anonymous creation policy')
    require(record['payload']['destination']==decoded, 'Final parameterized URL differs from Long output')
    require(record['payload']['channel']=='other' and record['payload']['label']=='', 'Unexpected metadata')
    require(16 <= len(record['key']) <= 128 and all(c.isalnum() or c in '_-' for c in record['key']), 'Invalid request key')
    require(p.locator('#copy-link-primary').get_attribute('data-copy-value') == 'https://l.marinhhs.org/test000001','Copy link differs')
    p.locator('#destination-url').fill('https://marincounty.gov/other')
    h.wait()
    require(len(h.calls()) == 1, 'Typing registered a second URL')
    require(p.locator('#final-url').text_content()=='' and p.locator('#copy-link-primary').is_disabled(), 'Stale URL is current')
    require(p.locator('#short-prior').is_visible() and p.locator('#short-prior-copy').get_attribute('data-copy-value').endswith('test000001'), 'Prior link unavailable')
    p.locator('#destination-url').fill('https://hhs.marincounty.gov/?a=1&a=2#section')
    h.wait()
    require(p.locator('#final-url').text_content().endswith('test000001'), 'Matching creation not reused locally')
    require(len(h.calls())==1,'Matching saved creation sent extra POST')
    require(not h.errors, 'Browser errors: '+str(h.errors))


def test_creation_metadata_mapping(h):
    cases = (("ch-01", "email"), ("ch-03", "social"), ("ch-05", "print"), ("ch-02", "other"))
    for option, expected in cases:
        p = h.open()
        p.locator('#tracking-channel').select_option(option)
        p.locator('#tracking-campaign-choice').select_option('__new__')
        p.locator('#tracking-campaign').fill('Fall Flu 2026')
        p.locator('#length-short').check()
        p.locator('#destination-url').fill(f'https://hhs.marincounty.gov/{expected}')
        h.wait()
        require(len(h.calls()) == 0, f'Preview sent a request for {expected}')
        p.locator('#short-create').click()
        p.wait_for_function("() => document.querySelector('#final-url').textContent.includes('test000001')")
        payload = h.calls()[0]['payload']
        require(payload['channel'] == expected, f'Channel {option} did not map to {expected}')
        require(payload['campaign'] == 'fall-flu-2026', 'Campaign metadata was not normalized')
        require(f'utm_medium={option}' in payload['destination'], 'Tracked channel code was lost from destination')
        require('utm_campaign=fall-flu-2026' in payload['destination'], 'Campaign was lost from destination')
        require(not h.errors, 'Browser errors: ' + str(h.errors))



def test_qr_and_stale(h):
    p=h.open()
    p.locator('#output-qr').check()
    p.locator('#qr-show-address').check()
    p.locator('#tracking-source').select_option('__new__')
    p.locator('#tracking-source-new').fill('Library Desk')
    p.locator('#tracking-content-choice').select_option('__new__')
    p.locator('#tracking-content').fill('Poster A')
    p.locator('#tracking-date').fill('2026-10-28')
    p.locator('#length-short').check()
    p.locator('#destination-url').fill('https://marincounty.gov/health?lang=en')
    h.wait()
    require(p.locator('#qr-show-address').is_disabled(), 'Short QR still offers the destination-address caption')
    require(p.locator('#download').is_disabled() and not p.locator('#qr-canvas').get_attribute('data-qr-ready'), 'QR exists before confirmation')
    require(len(h.calls()) == 0, 'Short QR preview submitted a creation request')
    p.locator('#short-create').click()
    p.wait_for_function("() => document.querySelector('#qr-canvas').dataset.qrReady === 'true'")
    require(p.locator('#qr-canvas').get_attribute('data-final-url') == 'https://l.marinhhs.org/test000001','QR encodes wrong URL')
    payload = h.calls()[0]['payload']
    query = parse_qs(urlparse(payload['destination']).query)
    require(payload['channel']=='qr' and query.get('via') == ['qr'], 'QR source metadata differs')
    require(query.get('utm_source') == ['library-desk'], 'The current Source field was lost from Short creation')
    require(query.get('utm_content') == ['261028-poster-a'], 'The current Content and Send date fields were lost from Short creation')
    require('l.marinhhs.org/test000001' in (p.locator('#qr-canvas').get_attribute('aria-label') or ''), 'Short QR caption does not use the confirmed Short URL')
    require(p.locator('#download').is_enabled(), 'QR download disabled')
    expected = 'https://l.marinhhs.org/test000001'
    require(decode_qr(canvas_png(p)) == expected, 'Preview QR image does not decode to the created short URL')
    with p.expect_download() as download_info:
        p.locator('#download').click()
    png_download = download_info.value
    require(png_download.suggested_filename.endswith('.png'), 'PNG export filename differs')
    require(decode_qr(Path(png_download.path()).read_bytes()) == expected, 'PNG export does not decode to the created short URL')
    p.locator('#download-format').select_option('svg')
    with p.expect_download() as download_info:
        p.locator('#download').click()
    svg_download = download_info.value
    svg = Path(svg_download.path()).read_text(encoding='utf-8')
    verify_svg(svg, expected, transparent=False, has_logo=False)
    require(decode_qr(cairosvg.svg2png(bytestring=svg.encode("utf-8"), output_width=1200, output_height=1200)) == expected, 'SVG export does not decode to the created short URL')
    p.locator('#destination-url').fill('https://marincounty.gov/health2')
    h.wait()
    require(p.locator('#download').is_disabled() and p.locator('#copy-link-primary').is_disabled(), 'Stale QR remains available')
    require(p.locator('#short-prior').is_visible(), 'Prior QR-created URL disappeared')
    require(len(h.calls())==1, 'Editing caused another POST')


def test_dropped_response_retry(h):
    p=h.open()
    p.locator('#length-short').check()
    p.locator('#destination-url').fill('https://hhs.marincounty.gov/flu')
    h.wait()
    p.evaluate('window.__mockDropNext=true')
    p.locator('#short-create').click()
    p.wait_for_function("() => document.querySelector('#short-create').textContent.includes('Try again')")
    require(len(h.calls())==1 and p.locator('#copy-link-primary').is_disabled(), 'Dropped response incorrectly confirmed a link')
    p.locator('#short-create').click()
    p.wait_for_function("() => document.querySelector('#final-url').textContent.endsWith('test000001')")
    require(len(h.calls())==2 and h.calls()[0]['key']==h.calls()[1]['key'], 'Uncertain retry changed the idempotency key')
    require(not h.errors,'Browser errors: '+str(h.errors))


def test_service_unavailable_retry(h):
    p=h.open()
    p.locator('#length-short').check()
    p.locator('#destination-url').fill('https://hhs.marincounty.gov/retry')
    h.wait()
    p.evaluate('window.__mockUnavailableNext=true')
    p.locator('#short-create').click()
    p.wait_for_function("() => document.querySelector('#short-status').textContent.includes('not available right now')")
    require(p.locator('#short-create').is_enabled(), 'Retry was disabled after a temporary outage')
    first_key=h.calls()[0]['key']
    p.locator('#short-create').click()
    p.wait_for_function("() => document.querySelector('#final-url').textContent.endsWith('test000001')")
    require(len(h.calls())==2 and h.calls()[1]['key']==first_key, 'Temporary-outage retry changed the request key')
    require(not h.errors, 'Browser errors: '+str(h.errors))


def test_capability_advisory(h):
    p=h.open()
    p.evaluate('window.__mockCapabilityAnonymous=false')
    p.locator('#length-short').check()
    p.locator('#destination-url').fill('https://hhs.marincounty.gov/disabled')
    p.wait_for_function("() => document.querySelector('#short-availability').textContent.includes('settings and approved websites')")
    p.wait_for_function("() => document.querySelector('#short-create').disabled")
    require(p.locator('#short-create').is_disabled(), 'Create remained enabled after the advisory said creation is unavailable')
    require(len(h.calls())==0, 'Capability discovery registered a short link')
    p.locator('#length-long').check()
    h.wait()
    require(p.locator('#final-url').text_content().startswith('https://l.marinhhs.org/?d='), 'Long links stopped working when Short creation was unavailable')
    require(not h.errors, 'Browser errors: '+str(h.errors))


def test_capability_base_fallback(h):
    p=h.open()
    p.evaluate("window.__mockCapabilityBase='https://example.invalid/'")
    result=p.evaluate("""async () => {
      const data=await window.MarinLinksShortApi.capabilities({refresh:true});
      return data.short_url_base_url;
    }""")
    require(result=='https://l.marinhhs.org/', 'Untrusted capability base replaced the configured Short URL base')
    require(len(h.calls())==0, 'Capability base check sent a creation request')


def test_known_code_validation(h):
    p=h.open()
    results=p.evaluate("""() => {
      const api=window.MarinLinksShortApi;
      const base=window.MarinLinksTracker.serverRoot;
      return {
        valid: api.normalizeKnownCode('Good-code1', base),
        full: api.normalizeKnownCode('https://l.marinhhs.org/good-code1', base),
        double: api.normalizeKnownCode('bad--code', base),
        trailing: api.normalizeKnownCode('bad-', base),
        slash: api.normalizeKnownCode('https://l.marinhhs.org/a%2Fb', base),
        query: api.normalizeKnownCode('https://l.marinhhs.org/good-code1?x=1', base),
        fragment: api.normalizeKnownCode('https://l.marinhhs.org/good-code1#x', base),
        foreign: api.normalizeKnownCode('https://example.invalid/good-code1', base),
        dot: api.normalizeKnownCode('https://l.marinhhs.org/extra/../good-code1', base),
        reserved: api.normalizeKnownCode('s', base)
      };
    }""")
    require(results['valid']=='good-code1' and results['full']=='good-code1', 'Valid known code was rejected')
    require(all(results[key] is None for key in ('double','trailing','slash','query','fragment','foreign','dot','reserved')), 'Unsafe known code was accepted')


def test_creation_denied(h):
    p=h.open()
    p.locator('#length-short').check()
    p.locator('#destination-url').fill('https://hhs.marincounty.gov/flu')
    h.wait()
    p.evaluate('window.__mockGlobalDenied=true')
    p.locator('#short-create').click()
    p.wait_for_function("() => document.querySelector('#short-status').textContent.includes('website or network')")
    require(p.locator('#final-url').text_content() == '' and p.locator('#copy-link-primary').is_disabled(),
            'Denied creation generated a short URL')
    require('Authorization' not in h.calls()[0]['headers'], 'Unauthorized attempt included a secret')
    require(not h.errors, 'Browser errors: ' + str(h.errors))


def test_single_duplicate_click(h):
    p=h.open()
    p.locator('#length-short').check()
    p.locator('#destination-url').fill('https://hhs.marincounty.gov/flu')
    h.wait()
    p.locator('#short-create').evaluate('el => { el.click(); el.click(); }')
    p.wait_for_function("() => document.querySelector('#final-url').textContent.endsWith('test000001')")
    require(len(h.calls()) == 1, 'Double-click issued duplicate server creation requests')
    require(not h.errors, 'Browser errors: ' + str(h.errors))


def test_invalid_server_url(h):
    p=h.open()
    p.locator('#length-short').check()
    p.locator('#destination-url').fill('https://hhs.marincounty.gov/flu')
    h.wait()
    p.evaluate('window.__mockForeignNext=true')
    p.locator('#short-create').click()
    p.wait_for_function("() => document.querySelector('#short-status').textContent.includes('unexpected address')")
    require(p.locator('#final-url').text_content() == '' and p.locator('#copy-link-primary').is_disabled(),
            'A short URL from another hostname was shown as valid')
    require(len(h.calls()) == 1, 'Unexpected creation requests after invalid server response')
    require(not h.errors, 'Browser errors: ' + str(h.errors))


def test_noncanonical_server_url(h):
    p=h.open()
    p.locator('#length-short').check()
    p.locator('#destination-url').fill('https://hhs.marincounty.gov/flu')
    h.wait()
    p.evaluate('window.__mockNonCanonicalNext=true')
    p.locator('#short-create').click()
    p.wait_for_function("() => document.querySelector('#short-status').textContent.includes('unexpected address')")
    require(p.locator('#final-url').text_content() == '', 'A noncanonical Short URL was accepted')
    require(p.locator('#short-create').text_content().strip() == 'Try again', 'Safe retry was not offered for a noncanonical response')


def test_malformed_success_retry(h):
    p=h.open()
    p.locator('#length-short').check()
    p.locator('#destination-url').fill('https://hhs.marincounty.gov/malformed')
    h.wait()
    p.evaluate('window.__mockMalformedSuccessNext=true')
    p.locator('#short-create').click()
    p.wait_for_function("() => document.querySelector('#short-status').textContent.includes('may have been made')")
    first_key=h.calls()[0]['key']
    p.locator('#short-create').click()
    p.wait_for_function("() => document.querySelector('#final-url').textContent.endsWith('test000001')")
    require(h.calls()[1]['key']==first_key, 'Malformed-success retry changed the request key')


def test_request_too_large(h):
    p=h.open()
    p.locator('#length-short').check()
    p.locator('#destination-url').fill('https://hhs.marincounty.gov/large')
    h.wait()
    p.evaluate('window.__mockTooLargeNext=true')
    p.locator('#short-create').click()
    p.wait_for_function("() => document.querySelector('#short-status').textContent.includes('too long')")
    require(p.locator('#short-create').is_disabled(), 'A rejected oversized request was offered as an unchanged retry')
    p.locator('#destination-url').fill('https://hhs.marincounty.gov/smaller')
    h.wait()
    require(p.locator('#short-create').is_enabled(), 'Changing an oversized request did not allow a new request')


def test_late_server_response(h):
    p=h.open()
    p.locator('#length-short').check()
    p.locator('#destination-url').fill('https://marincounty.gov/old')
    h.wait()
    p.evaluate('window.__mockSlowNext=true')
    p.locator('#short-create').click()
    p.locator('#destination-url').fill('https://marincounty.gov/new')
    p.wait_for_function("() => document.querySelector('#short-prior') && !document.querySelector('#short-prior').hidden")
    require(p.locator('#final-url').text_content() == '' and p.locator('#copy-link-primary').is_disabled(),
            'Late response was treated as the current destination')
    require(p.locator('#short-prior-copy').get_attribute('data-copy-value') == 'https://l.marinhhs.org/test000001',
            'Created link disappeared instead of being shown as the prior result')
    require(not h.errors, 'Browser errors: ' + str(h.errors))


def test_nested_server_base(h):
    p=h.open()
    p.evaluate("""() => {
      const root = 'https://example.gov/apps/links/';
      window.MarinLinksTracker = Object.freeze({serverRoot: root, sourcePath: '/marin-links/',
        endpoint:root, apiBase:new URL('s/api/v1/',root).href,
        createEndpoint:new URL('s/api/v1/short-links',root).href});
    }""")
    p.locator('#length-short').check()
    p.locator('#destination-url').fill('https://hhs.marincounty.gov/vaccine')
    h.wait()
    p.locator('#short-create').click()
    p.wait_for_function("() => document.querySelector('#final-url').textContent.endsWith('/apps/links/test000001')")
    require(h.calls()[0]['url'] == 'https://example.gov/apps/links/s/api/v1/short-links',
            'Nested server root did not update the creation endpoint')
    require(p.locator('#final-url').text_content() == 'https://example.gov/apps/links/test000001',
            'Nested server root did not preserve short URL base')
    p.locator('#length-long').check()
    h.wait()
    require(p.locator('#final-url').text_content().startswith('https://example.gov/apps/links/?d='),
            'Nested server root did not update tracked redirects')
    require(not h.errors, 'Browser errors: ' + str(h.errors))


def test_batch(h):
    p=h.open()
    p.locator('#many-addresses').check()
    p.locator('#length-short').check()
    p.locator('#bulk-urls').fill('https://marincounty.gov/one\nhttp://bad.example/\nhttps://marincounty.gov/two')
    h.wait()
    require(len(h.calls())==0,'Bulk preview registered links')
    require(p.locator('#bulk-rows tr').count()==3,'Expected three rows in batch preview')
    require(p.locator('#short-bulk-create').is_enabled(),'Short batch action disabled')
    p.locator('#short-bulk-create').click()
    p.wait_for_function("() => document.querySelector('#bulk-summary').textContent.includes('2 of 2')")
    require(len(h.calls())==2,'Batch did not send exactly the valid rows')
    require(p.evaluate('window.__shortMaxInFlight')==1, 'Batch sent more than one request at a time')
    destinations = [urlparse(r['payload']['destination']) for r in h.calls()]
    require([item.path for item in destinations] == ['/one', '/two'], 'Batch input order changed')
    require(
        all(parse_qs(item.query).get('utm_source') == ['marin-county'] and parse_qs(item.query).get('via') == ['link'] for item in destinations),
        'Fresh baseline tracking labels were not kept in the Short batch'
    )
    require(p.locator('#bulk-rows tr').nth(1).text_content().find('Needs correction')>=0,'Bad row not marked')
    require(p.locator('#bulk-copy').get_attribute('data-copy-value').count('\n')==1,'Copy contains uncreated links')
    require(p.locator('#short-bulk-retry').is_hidden(),'Batch retry incorrectly available')
    # Changing after creation must preserve the previous batch instead of silently reusing its links.
    p.locator('#bulk-urls').fill('https://marincounty.gov/three')
    h.wait()
    require(p.locator('#short-bulk-prior').is_visible(), 'Previous batch not retained')
    require(p.locator('#short-bulk-prior-copy').get_attribute('data-copy-value').count('\n')==1,'Previous batch links not copyable')


def test_batch_server_rejection_continues(h):
    p=h.open()
    p.locator('#many-addresses').check()
    p.locator('#length-short').check()
    p.locator('#bulk-urls').fill('https://marincounty.gov/ok-one\nhttps://marincounty.gov/server-rejected\nhttps://marincounty.gov/ok-two')
    h.wait()
    p.locator('#short-bulk-create').click()
    p.wait_for_function("() => document.querySelector('#bulk-summary').textContent.includes('2 of 3')")
    require(len(h.calls())==3, 'A row-level server rejection stopped later eligible rows')
    require('Needs correction' in p.locator('#bulk-rows tr').nth(1).text_content(), 'Rejected row was not marked for correction')
    require(p.locator('#bulk-copy').get_attribute('data-copy-value').count('\n')==1, 'Rejected row was included in Copy all')


def test_batch_global_denial_stops(h):
    p=h.open()
    p.locator('#many-addresses').check()
    p.locator('#length-short').check()
    p.locator('#bulk-urls').fill('https://marincounty.gov/a\nhttps://marincounty.gov/b\nhttps://marincounty.gov/c')
    h.wait()
    p.evaluate('window.__mockGlobalDenied=true')
    p.locator('#short-bulk-create').click()
    p.wait_for_function("() => document.querySelector('#short-bulk-retry') && !document.querySelector('#short-bulk-retry').hidden")
    require(len(h.calls())==1, 'A global creation denial did not stop the batch')
    require(p.locator('#bulk-rows').text_content().count('Not attempted')==3, 'Denied and remaining rows were not preserved for retry')


def test_batch_preview_and_stop(h):
    p=h.open()
    p.locator('#many-addresses').check()
    p.locator('#length-short').check()
    p.locator('#bulk-urls').fill('\n'.join(f'https://marincounty.gov/item-{i}' for i in range(100)))
    h.wait(700)
    require(len(h.calls())==0, 'A 100-row preview submitted creation requests')
    require(p.locator('#bulk-rows tr').count()==100, 'The 100-row limit did not remain available')

    p.locator('#bulk-urls').fill('\n'.join(f'https://marincounty.gov/stop-{i}' for i in range(4)))
    h.wait()
    p.evaluate('window.__mockDelayEvery=350')
    p.locator('#short-bulk-create').click()
    p.wait_for_function('() => window.__shortInFlight === 1')
    p.locator('#short-bulk-stop').click()
    p.wait_for_function("() => document.querySelector('#short-bulk-progress').textContent.includes('Stopped')")
    require(len(h.calls())==1, 'Stop did not stop after the current request')
    require(p.locator('#bulk-rows').text_content().count('Not attempted')==3, 'Rows after Stop were not left unattempted')
    require(p.evaluate('window.__shortMaxInFlight')==1, 'Stopped batch sent requests in parallel')


def test_batch_unknown_retry(h):
    p=h.open()
    p.locator('#many-addresses').check()
    p.locator('#length-short').check()
    p.locator('#bulk-urls').fill('https://marincounty.gov/a\nhttps://marincounty.gov/b\nhttps://marincounty.gov/c')
    h.wait()
    p.evaluate('window.__mockDropNext=true')
    p.locator('#short-bulk-create').click()
    p.wait_for_function("() => document.querySelector('#bulk-rows').textContent.includes('Unknown—retry safely')")
    require(len(h.calls())==1, 'Unknown batch result did not stop further requests')
    first_key=h.calls()[0]['key']
    p.locator('#short-bulk-retry').click()
    p.wait_for_function("() => document.querySelector('#bulk-summary').textContent.includes('3 of 3')")
    require(len(h.calls())==4, 'Safe batch retry resent completed rows or skipped pending rows')
    require(h.calls()[1]['key']==first_key, 'Unknown batch row retry changed the request key')
    require(p.locator('#bulk-copy').get_attribute('data-copy-value').count('\n')==2, 'Safe retry did not keep all confirmed results')


def test_batch_rate_limit(h):
    p=h.open()
    p.locator('#many-addresses').check()
    p.locator('#length-short').check()
    p.locator('#bulk-urls').fill('\n'.join(f'https://marincounty.gov/p{i}' for i in range(5)))
    h.wait()
    p.evaluate('window.__mockRateAfter=2')
    p.locator('#short-bulk-create').click()
    p.wait_for_function("() => document.querySelector('#short-bulk-retry') && !document.querySelector('#short-bulk-retry').hidden")
    require(len(h.calls())==3, 'Rate limited batch should stop after first 429')
    require(p.locator('#bulk-copy').get_attribute('data-copy-value').count('\n')==1,'Rate limit lost earlier successful links')
    require('Not attempted' in p.locator('#bulk-rows tr').nth(4).text_content(),'Unattempted row not labeled')
    first_rate_key=h.calls()[2]['key']
    p.evaluate('window.__mockRateAfter=null')
    p.locator('#short-bulk-retry').click()
    p.wait_for_function("() => document.querySelector('#bulk-summary').textContent.includes('5 of 5')")
    require(len(h.calls())==6,'Retry resent already confirmed requests or skipped pending')
    require(h.calls()[3]['key']==first_rate_key,'Retry of rate-limited row generated a new idempotency key')


def test_stats(h):
    p=h.open()
    p.locator('#tab-stats').click()
    p.locator('#stats-report').select_option('short')
    p.wait_for_function("() => document.querySelector('#stats-kpi-visits').textContent === '22'")
    require(p.locator('#stats-via-card').is_hidden() and p.locator('#stats-short-code-field').is_visible(), 'Tracked controls shown in short report')
    require(p.locator('#stats-short-overall-heading').is_visible(), 'Overall Short URL heading is missing')
    # about:blank fixtures cannot build a real shareable GitHub Pages URL.
    p.locator('#stats-short-code').fill('https://l.marinhhs.org/sample0123')
    p.locator('#stats-short-show').click()
    p.wait_for_function("() => document.querySelector('#stats-short-kpi-visits').textContent === '7'")
    require(p.locator('#stats-kpi-visits').text_content() == '22', 'Known-code report replaced the overall total')
    require(p.locator('#stats-short-detail').is_visible() and p.locator('#stats-short-detail-data').is_visible(), 'Per-code report is missing')
    require(p.locator('#stats-short-daily tr').count() == 2, 'Per-code daily table is missing')
    with p.expect_download() as download_info:
        p.locator('#stats-csv').click()
    csv_text=Path(download_info.value.path()).read_text(encoding='utf-8-sig')
    require('All Short URLs' in csv_text and 'One Short URL' in csv_text and 'sample0123' in csv_text, 'Short CSV did not keep both report levels')
    require('hhs.marincounty.gov' not in csv_text and 'marincounty.gov/' not in csv_text, 'Short CSV leaked a private destination')

    p.evaluate("window.__mockDetailMode='suppressed'")
    p.locator('#stats-short-code').fill('quiet-code')
    p.locator('#stats-short-show').click()
    p.wait_for_function("() => document.querySelector('#stats-short-detail-status').textContent === 'Too few visits to show.'")
    require(p.locator('#stats-kpi-visits').text_content() == '22', 'Suppressed code hid the overall report')
    require(p.locator('#stats-short-detail-data').is_hidden(), 'Suppressed code showed detail data')

    p.evaluate("window.__mockDetailMode='not_found'")
    p.locator('#stats-short-code').fill('missing-code')
    p.locator('#stats-short-show').click()
    p.wait_for_function("() => document.querySelector('#stats-short-detail-status').textContent.includes('not available')")
    require(p.locator('#stats-kpi-visits').text_content() == '22', 'Missing code hid the overall report')

    p.locator('#stats-short-code').fill('https://example.invalid/sneak')
    p.locator('#stats-short-show').click()
    require(p.locator('#stats-short-code').get_attribute('aria-invalid')=='true','Foreign short URL was accepted')
    require(not h.errors, 'Browser errors: '+str(h.errors))


def test_layout(h, out):
    for scheme in ('light','dark'):
        for width in (320, 390, 1440):
            context=h.context.browser.new_context(viewport={'width':width,'height':820},color_scheme=scheme)
            case=TestHarness(context)
            p=case.open()
            p.locator('#length-short').check()
            p.locator('#destination-url').fill('https://marincounty.gov/innovation?utm_source=posters')
            case.wait()
            require(p.locator('#short-create').is_visible(),f'Missing create button at {width}/{scheme}')
            no_overflow(p)
            if out:
                (out/f'create-short-{scheme}-{width}.png').write_bytes(p.screenshot(full_page=True))
            p.locator('#tab-stats').click()
            p.locator('#stats-report').select_option('short')
            p.wait_for_function("() => document.querySelector('#stats-kpi-visits').textContent === '22'")
            no_overflow(p)
            if out:
                (out/f'stats-short-{scheme}-{width}.png').write_bytes(p.screenshot(full_page=True))
            context.close()


CASES = (
    test_long_and_single,
    test_creation_metadata_mapping,
    test_qr_and_stale,
    test_dropped_response_retry,
    test_service_unavailable_retry,
    test_capability_advisory,
    test_capability_base_fallback,
    test_known_code_validation,
    test_creation_denied,
    test_single_duplicate_click,
    test_invalid_server_url,
    test_noncanonical_server_url,
    test_malformed_success_retry,
    test_request_too_large,
    test_late_server_response,
    test_nested_server_base,
    test_batch,
    test_batch_server_rejection_continues,
    test_batch_global_denial_stops,
    test_batch_preview_and_stop,
    test_batch_unknown_retry,
    test_batch_rate_limit,
    test_stats,
)
CASE_BY_NAME = {case.__name__: case for case in CASES}
CASE_GROUPS = (
    tuple(case.__name__ for case in CASES[:8]),
    tuple(case.__name__ for case in CASES[8:16]),
    tuple(case.__name__ for case in CASES[16:]),
)


def run_browser_cases(case_names: tuple[str, ...], screenshots: Path | None = None) -> None:
    with sync_playwright() as p:
        opts=dict(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        exe=shutil.which('chromium')
        if exe: opts['executable_path']=exe
        browser=p.chromium.launch(**opts)
        try:
            context=browser.new_context(
                viewport={'width':1280,'height':900},
                color_scheme='dark',
                accept_downloads=True,
            )
            try:
                harness=TestHarness(context)
                for case_name in case_names:
                    CASE_BY_NAME[case_name](harness)
                if screenshots is not None:
                    test_layout(harness,screenshots)
            finally:
                context.close()
        finally:
            browser.close()


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--screenshots',type=Path)
    parser.add_argument('--case',action='append',choices=[*CASE_BY_NAME],help=argparse.SUPPRESS)
    args=parser.parse_args()
    if args.screenshots:args.screenshots.mkdir(parents=True,exist_ok=True)

    if not args.case:
        script = Path(__file__).resolve()
        for group in CASE_GROUPS:
            command = [sys.executable, str(script)]
            for case_name in group:
                command.extend(("--case", case_name))
            subprocess.run(command, check=True)
        if args.screenshots is not None:
            run_browser_cases(("test_known_code_validation",), args.screenshots)
        print('Short-link frontend creation, QR, batch, retries, Stats and privacy mocks: PASS')
        return

    selected=tuple(args.case)
    run_browser_cases(selected,args.screenshots)
    print('Short-link mock cases '+', '.join(selected)+': PASS')

if __name__=='__main__': main()
