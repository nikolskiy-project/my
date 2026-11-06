import sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from update_rules import extract,parse,info_links

class ImporterTests(unittest.TestCase):
    def test_forum_html(self):
        html='''<article data-commentid="1"><div data-role="commentContent"><p>1. Общие положения</p><p>1.1 — Положение устанавливает порядок службы.</p><p>1.2 — Запрещено нарушать приказы.</p><ul><li>Исключение: по разрешению командира.</li></ul><p>2.1 — Объявляется выговор.</p></div></article>'''
        lines,links=extract(html)
        items=parse(lines,'ustav')
        self.assertEqual([x['number'] for x in items],['1.1','1.2','2.1'])
        self.assertIn('Исключение',items[1]['text'])
    def test_no_chrome_as_rules(self):
        html='<html><body><p>5.1 — В меню отображается пункт.</p></body></html>'
        lines,_=extract(html)
        self.assertEqual(lines,[])
    def test_info_links(self):
        links=[('Порядок применения взысканий','https://forum.gtaprovince.ru/topic/123-test/')]
        self.assertEqual(len(info_links([],links,'info')),1)

if __name__=='__main__':unittest.main()
