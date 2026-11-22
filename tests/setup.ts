const TEST_FIXTURE_KID = 'provn-server-test-fixture'
const TEST_FIXTURE_SECRET = '4N7gBSB3K4SgqqkcBqaHnzqR12mc4XbnvS7Adx1SyeyiNVUTwF5AHoTrULhegPm3TYQWsWLJ5tHaBE9Yko5Dvbuj'

if (!process.env.PROVN_SERVER_SECRET) {
  process.env.PROVN_KID = TEST_FIXTURE_KID
  process.env.PROVN_SERVER_SECRET = TEST_FIXTURE_SECRET
}
