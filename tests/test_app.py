import json
import sys
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server

class AppTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db_patch = patch.object(server, 'DB', str(Path(self.tmp.name) / 'test.sqlite3'))
        self.db_patch.start()
        self.env_patch = patch.dict(server.os.environ, {'OPENAI_API_KEY': ''})
        self.env_patch.start()
        server.init_db()

    def tearDown(self):
        self.env_patch.stop()
        self.db_patch.stop()
        self.tmp.cleanup()

    def test_chat_demo_is_explicit(self):
        result = server.action('/api/chat', {'message': 'Como organizar minha rotina?'})
        self.assertEqual(result['mode'], 'demo')
        self.assertTrue(result['reply'])
        with self.assertRaises(server.ValidationError):
            server.action('/api/chat', {'message': ' '})
        with self.assertRaises(server.ValidationError):
            server.action('/api/chat', {'message': 'x' * 2001})

    def test_openai_request_keeps_key_on_server(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return b'{"choices":[{"message":{"content":"Plano personalizado"}}]}'
        with patch.dict(server.os.environ, {'OPENAI_API_KEY': 'test-only'}), patch.object(server.urllib.request, 'urlopen', return_value=Response()) as call:
            result = server.action('/api/chat', {'message': 'Planeje meu dia'})
            self.assertEqual(result, {'reply': 'Plano personalizado', 'mode': 'openai'})
            request = call.call_args.args[0]
            self.assertEqual(request.get_header('Authorization'), 'Bearer test-only')
            self.assertEqual(json.loads(request.data)['messages'][1]['content'], 'Planeje meu dia')

    def test_provider_failure_is_clear(self):
        with patch.dict(server.os.environ, {'OPENAI_API_KEY': 'test-only'}), patch.object(server.urllib.request, 'urlopen', side_effect=urllib.error.URLError('offline')):
            with self.assertRaisesRegex(server.ValidationError, 'consultar a IA'):
                server.action('/api/chat', {'message': 'Olá'})

    def test_personal_persistence_and_validation(self):
        if server.KIND != 'personal': self.skipTest('Outro projeto')
        state = server.action('/api/tasks', {'title': 'Comprar pão', 'due': '2026-12-01'})
        task = state['tasks'][0]
        state = server.action('/api/tasks/toggle', {'id': task['id']})
        self.assertEqual(state['tasks'][0]['done'], 1)
        self.assertEqual(server.get_state()['tasks'][0]['title'], 'Comprar pão')
        server.action('/api/tasks/toggle', {'id': task['id']})
        self.assertEqual(server.get_state()['tasks'][0]['done'], 0)
        for value in (-1, 0, True, 1.3, '10'):
            with self.assertRaises(server.ValidationError):
                server.action('/api/expenses', {'title': 'Inválido', 'cents': value})
        with self.assertRaises(server.ValidationError):
            server.action('/api/tasks', {'title': 'X', 'due': '2026-99-99'})
        state = server.action('/api/expenses', {'title': 'Mercado', 'cents': 2590})
        self.assertEqual(state['expenses'][0]['cents'], 2590)
        server.action('/api/expenses/delete', {'id': state['expenses'][0]['id']})
        server.action('/api/tasks/delete', {'id': task['id']})
        self.assertEqual(server.get_state(), {'tasks': [], 'expenses': []})



    def test_http_assets_json_and_origin(self):
        httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        base = 'http://127.0.0.1:' + str(httpd.server_port)
        try:
            for path in ('/', '/style.css', '/app.js', '/api/health', '/api/state'):
                with urllib.request.urlopen(base + path) as response:
                    self.assertEqual(response.status, 200)
                    self.assertTrue(response.read())
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(base + '/server.py')
            self.assertEqual(error.exception.code, 404)
            request = urllib.request.Request(base + '/api/chat', data=b'{"message":"Oi"}', headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(request) as response:
                self.assertEqual(json.load(response)['mode'], 'demo')
            request.add_header('Origin', 'https://foreign.example')
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(request)
            self.assertEqual(error.exception.code, 403)
            request = urllib.request.Request(base + '/api/chat', data=b'[]', headers={'Content-Type': 'application/json'})
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(request)
            self.assertEqual(error.exception.code, 400)
        finally:
            httpd.shutdown()
            httpd.server_close()
            thread.join()

if __name__ == '__main__':
    unittest.main()
