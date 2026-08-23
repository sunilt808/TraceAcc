"""
e2e_build_phase.py — live production test for DC-LCG + Patterns + Intel.

Flow:
  1. analyst login
  2. train DC-LCG on labeled CSV  → POST /dclcg/train
  3. list registry                → GET /dclcg/models
  4. advanced analyze (dclcg on)  → POST /analyze/advanced
  5. verify dclcg block in stored result + hybrid breakdown dimension
  6. run 15-pattern suite w/ dclcg→ POST /patterns/analyze (job re-run)
  7. investigator login → intel overview / similar / paths
  8. admin login → patterns RBAC check (403)
"""
import io
import json
import sys

import requests

BASE = "http://127.0.0.1:8000"


def login(username, password):
    r = requests.post(
        f"{BASE}/auth/login",
        data={"username": username, "password": password},
        timeout=30,
    )
    assert r.status_code == 200, f"login {username}: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def labeled_csv():
    rows = ["sender,receiver,amount,timestamp,label"]
    i = 0

    def tx(s, rv, amt, label):
        nonlocal i
        i += 1
        rows.append(
            f"{s},{rv},{amt},2024-01-{(i % 28) + 1:02d} "
            f"{(i * 7) % 24:02d}:{(i * 13) % 60:02d}:00,{label}"
        )

    # mule ring (labeled illicit)
    for k in range(10):
        tx(f"SRC{k}", f"MULE{1 + k % 3}", 8800 + k * 7, 1)
    for k in range(14):
        tx(f"MULE{1 + k % 3}", f"LAYER{1 + k % 3}", 8700 - k * 3, 1)
    for k in range(12):
        tx(f"LAYER{1 + k % 3}", f"CASH{k}", 8500 + k * 5, 1)
    # background noise (licit)
    import random
    random.seed(42)
    for k in range(160):
        a, b = random.randint(0, 30), random.randint(0, 30)
        if a != b:
            amt = random.choice([50, 120, 340, 780, 1250, 2300])
            hh = random.choice([9, 10, 11, 14, 15, 16])
            rows.append(
                f"BGT{a},BGT{b},{amt},"
                f"2024-0{random.randint(1, 8)}-{random.randint(1, 28):02d} "
                f"{hh}:{random.randint(0, 59):02d}:00,0"
            )
    return "\n".join(rows)


def analysis_csv():
    """Unlabeled dataset with a clear ring for the analyze step."""
    rows = ["sender,receiver,amount,timestamp"]
    i = 0

    def tx(s, rv, amt):
        nonlocal i
        i += 1
        rows.append(
            f"{s},{rv},{amt},2024-02-{(i % 28) + 1:02d} {(i * 5) % 24:02d}:00:00"
        )

    for k in range(10):
        tx(f"S{k}", f"M{k % 3}", 8900 - k * 3)
    for k in range(12):
        tx(f"M{k % 3}", f"L{k % 3}", 8800 - k * 2)
    for k in range(10):
        tx(f"L{k % 3}", f"X{k}", 8700 + k)
    import random
    random.seed(7)
    for k in range(120):
        a, b = random.randint(0, 25), random.randint(0, 25)
        if a != b:
            tx(f"N{a}", f"N{b}", random.choice([100, 250, 600, 1500]))
    return "\n".join(rows)


def main():
    ok = []

    # ── 1. analyst ────────────────────────────────────────────────
    ah = login("analyst", "Password123!")
    ok.append("analyst login")

    # ── 2. train DC-LCG ───────────────────────────────────────────
    r = requests.post(
        f"{BASE}/dclcg/train",
        headers=ah,
        files={"request_file": ("labeled.csv", labeled_csv().encode(), "text/csv")},
        data={"model_name": "prod_e2e", "epochs": "20"},
        timeout=600,
    )
    assert r.status_code == 200, f"train: {r.status_code} {r.text[:400]}"
    train = r.json()
    assert train["supervised"] is True
    m = train["metrics"]
    print(f"[train] model={train['model']} accounts={train['n_accounts']} "
          f"f1={m.get('f1')} auc={m.get('auc')} ap={m.get('average_precision')}")
    ok.append(f"dclcg trained (f1={m.get('f1')})")

    # ── 3. registry ───────────────────────────────────────────────
    r = requests.get(f"{BASE}/dclcg/models", headers=ah, timeout=30)
    assert r.status_code == 200 and r.json()["total"] >= 1
    latest = [x for x in r.json()["items"] if x["is_latest"]][0]
    print(f"[registry] total={r.json()['total']} latest={latest['name']}")
    ok.append(f"registry lists {latest['name']}")

    # ── 4. advanced analysis (SR-linked so dataset persists) ──────
    ch = login("client", "Password123!")
    r = requests.post(
        f"{BASE}/service-requests",
        headers=ch,
        json={"title": "E2E ring trace", "description": "build-phase e2e",
              "request_type": "ANALYSIS"},
        timeout=30,
    )
    if r.status_code == 201:
        sr_id = r.json()["id"] if isinstance(r.json(), dict) else None
        sr_id = sr_id or r.json().get("request", {}).get("id")
    else:
        # reuse most recent own request
        r2 = requests.get(f"{BASE}/service-requests", headers=ch, timeout=30)
        items = r2.json()
        items = items.get("items") if isinstance(items, dict) else items
        assert items, "no service requests available"
        sr_id = items[0]["id"]
    assert sr_id, f"could not resolve service request id ({r.status_code})"
    r = requests.post(
        f"{BASE}/service-requests/{sr_id}/upload",
        headers=ch,
        files={"file": ("ring.csv", analysis_csv().encode(), "text/csv")},
        timeout=60,
    )
    assert r.status_code == 200, f"sr upload: {r.status_code} {r.text[:300]}"

    r = requests.post(
        f"{BASE}/analyze/advanced",
        headers=ah,
        files={"file": ("ring.csv", analysis_csv().encode(), "text/csv")},
        data={"use_dclcg": "true", "service_request_id": str(sr_id)},
        timeout=300,
    )
    assert r.status_code == 200, f"analyze: {r.status_code} {r.text[:400]}"
    payload = r.json()
    job_id = payload["job_id"]
    result = payload  # result is returned flat with job_id injected
    dclcg_block = result.get("dclcg", {})
    assert dclcg_block.get("available") is True, f"dclcg block: {dclcg_block}"
    hybrid = result["hybrid_scores"]
    has_dim = any("dclcg_score" in h.get("breakdown", {}) for h in hybrid)
    assert has_dim, "hybrid breakdown missing dclcg_score"
    print(f"[analyze] job={job_id} dclcg_model={dclcg_block['model']} "
          f"flagged={dclcg_block['flagged_count']}/{dclcg_block['n_scored']}")
    top = dclcg_block["top_accounts"][0]
    print(f"[analyze] top={top['account_id']} p={top['illicit_prob']:.3f} "
          f"path={top['top_paths'][:1]}")
    ok.append(f"analysis job {job_id} with DC-LCG dim")

    # ── 5. stored result reloadable ───────────────────────────────
    r = requests.get(f"{BASE}/analyze/jobs/{job_id}/result", headers=ah, timeout=30)
    assert r.status_code == 200
    stored = r.json()
    assert (stored.get("dclcg") or {}).get("available") is True
    ok.append("stored result persists dclcg block")

    # ── 6. pattern suite on same dataset (upload mode) ────────────
    r = requests.post(
        f"{BASE}/patterns/analyze",
        headers=ah,
        files={"file": ("ring.csv", analysis_csv().encode(), "text/csv")},
        data={"use_dclcg": "true"},
        timeout=300,
    )
    assert r.status_code == 200, f"patterns: {r.status_code} {r.text[:400]}"
    ps = r.json()
    assert ps["total_patterns"] == 15
    assert ps["tiers"] == {"basic": 5, "intermediate": 5, "advanced_ml": 5}
    assert ps["dclcg_available"] is True
    flagged = {p["key"]: p["flagged_count"] for p in ps["patterns"]}
    print(f"[patterns] tiers OK · flagged={flagged}")
    ok.append("15-pattern suite incl. DC-LCG")

    # ── 7. investigator intel ─────────────────────────────────────
    ih = login("investigator", "Password123!")
    target = dclcg_block["top_accounts"][0]["account_id"]

    r = requests.get(
        f"{BASE}/intel/accounts/{target}/overview", headers=ih, timeout=60)
    ov = None
    if r.status_code != 200:
        # fallback: pick any account present in stored hybrid scores
        cand = next(h["account_id"] for h in hybrid)
        r = requests.get(
            f"{BASE}/intel/accounts/{cand}/overview", headers=ih, timeout=60)
        target = cand
    assert r.status_code == 200, f"overview: {r.status_code} {r.text[:300]}"
    ov = r.json()
    print(f"[intel] overview account={target} jobs_seen={ov['jobs_scanned']} "
          f"alerts={ov['linked_alert_count']}")
    ok.append("intel overview")

    r = requests.get(
        f"{BASE}/intel/accounts/{target}/similar?top=6", headers=ih, timeout=60)
    assert r.status_code == 200, f"similar: {r.status_code} {r.text[:300]}"
    sims = r.json()["candidates"]
    print(f"[intel] similar: {[c['account_id'] for c in sims[:4]]}")
    ok.append(f"intel similar ({len(sims)} candidates)")

    r = requests.get(
        f"{BASE}/intel/accounts/{target}/paths",
        headers=ih, params={"job_id": job_id, "depth": 3, "top": 4},
        timeout=120,
    )
    assert r.status_code == 200, f"paths: {r.status_code} {r.text[:300]}"
    pp = r.json()["paths"]
    print(f"[intel] paths:")
    for p in pp:
        print(f"   {' -> '.join(p['path'])} | ${p['total_amount']:,.0f} "
              f"| score={p['score']}")
    assert len(pp) > 0
    ok.append("intel money paths")

    # ── 8. admin RBAC on patterns (analyst-only) ──────────────────
    admh = login("admin", "Password123!")
    r = requests.post(
        f"{BASE}/patterns/analyze",
        headers=admh,
        data={"use_dclcg": "false"},
        timeout=30,
    )
    assert r.status_code == 403, f"admin should be blocked: {r.status_code}"
    ok.append("patterns RBAC blocks admin (analyst-only)")

    print("\n=== E2E PASS ===")
    for step in ok:
        print(f" ✓ {step}")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as exc:
        print(f"\n=== E2E FAIL ===\n{exc}", file=sys.stderr)
        sys.exit(1)
