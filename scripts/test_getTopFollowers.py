import unittest

from scripts.getTopFollowers import render_follower_cell


class RenderFollowerCellTest(unittest.TestCase):
    def test_escapes_untrusted_display_name(self):
        cell = render_follower_cell(
            login="octocat",
            database_id=1,
            display_name='A&B <script> "quoted"',
        )

        self.assertIn("A&amp;B &lt;script&gt; &quot;quoted&quot;", cell)
        self.assertNotIn("<script>", cell)


if __name__ == "__main__":
    unittest.main()
