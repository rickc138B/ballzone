import requests
import json
import urllib.request

SUPABASE_URL = input("Supabase URL: ").strip()
SUPABASE_KEY = input("Supabase service role key: ").strip()

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://www.nba.com",
    "Accept": "application/json",
}

def supabase_upsert(table, rows):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    data = json.dumps(rows).encode()
    req = urllib.request.Request(url, data=data, method='POST')
    req.add_header('apikey', SUPABASE_KEY)
    req.add_header('Authorization', f'Bearer {SUPABASE_KEY}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Prefer', 'resolution=merge-duplicates')
    try:
        with urllib.request.urlopen(req) as res:
            print(f"  Upserted {len(rows)} rows to {table} ({res.status})")
    except Exception as e:
        print(f"  Error upserting to {table}: {e}")

print("Inserting NBA league...")
supabase_upsert('pro_leagues', [{
    'id': 'nba-2024-25',
    'name': 'NBA',
    'slug': 'nba',
    'region': 'north_america',
    'season': '2024-25',
}])

print("Fetching player stats...")
res = requests.get(
    "https://stats.nba.com/stats/leagueLeaders?LeagueID=00&PerMode=PerGame&Scope=S&Season=2024-25&SeasonType=Regular+Season&StatCategory=PTS",
    headers=HEADERS, timeout=30
)
data = res.json()
stat_headers = data['resultSet']['headers']
stat_rows = data['resultSet']['rowSet']

players = []
seasons = []
teams_seen = set()
teams = []

for row in stat_rows[:200]:
    r = dict(zip(stat_headers, row))
    pid = f"nba-player-{r['PLAYER_ID']}"
    tid = f"nba-team-{r['TEAM_ID']}"

    if r['TEAM_ID'] not in teams_seen:
        teams_seen.add(r['TEAM_ID'])
        teams.append({
            'id': tid,
            'league_id': 'nba-2024-25',
            'name': r['TEAM'],
            'abbreviation': r['TEAM'],
        })

    players.append({
        'id': pid,
        'name': r['PLAYER'],
        'current_team_id': tid,
        'external_id': str(r['PLAYER_ID']),
    })

    seasons.append({
        'id': f"nba-season-{r['PLAYER_ID']}-2024-25",
        'player_id': pid,
        'team_id': tid,
        'league_id': 'nba-2024-25',
        'season': '2024-25',
        'games_played': r.get('GP'),
        'pts': r.get('PTS'),
        'reb': r.get('REB'),
        'ast': r.get('AST'),
        'stl': r.get('STL'),
        'blk': r.get('BLK'),
        'tov': r.get('TOV'),
        'fg_pct': r.get('FG_PCT'),
        'three_pct': r.get('FG3_PCT'),
        'ft_pct': r.get('FT_PCT'),
        'minutes': r.get('MIN'),
    })

print(f"Found {len(teams)} teams, {len(players)} players")
supabase_upsert('pro_teams', teams)
supabase_upsert('pro_players', players)
supabase_upsert('pro_player_seasons', seasons)
print("Done!")
