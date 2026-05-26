export interface UpdateInfo {
  has_update: boolean;
  current_version: string;
  latest_version: string;
  release_name: string;
  release_body: string;
  release_url: string;
  download_url: string | null;
}

const OWNER = "Ahmad-J-Bary";
const REPO = "accounting-app";

function parseSemver(version: string): [number, number, number] {
  const v = version.replace(/^v/, "");
  const parts = v.split(".");
  return [
    parseInt(parts[0]) || 0,
    parseInt(parts[1]) || 0,
    parseInt(parts[2]) || 0,
  ];
}

function compareVersions(current: string, latest: string): boolean {
  const [cmaj, cmin, cpat] = parseSemver(current);
  const [lmaj, lmin, lpat] = parseSemver(latest);
  if (lmaj !== cmaj) return lmaj > cmaj;
  if (lmin !== cmin) return lmin > cmin;
  return lpat > cpat;
}

export const updateService = {
  async checkForUpdates(currentVersion: string): Promise<UpdateInfo> {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": `${OWNER}/${REPO}`,
      },
    });

    if (!res.ok) {
      throw new Error(`GitHub API returned ${res.status}`);
    }

    const release = await res.json();

    const latestVersion = release.tag_name;
    const hasUpdate = compareVersions(currentVersion, latestVersion);

    const asset = (release.assets || []).find(
      (a: { name: string; browser_download_url: string }) =>
        a.name.endsWith(".exe") || a.name.endsWith(".msi") || a.name.endsWith(".dmg")
    );

    return {
      has_update: hasUpdate,
      current_version: currentVersion,
      latest_version: latestVersion,
      release_name: release.name,
      release_body: release.body || "",
      release_url: release.html_url,
      download_url: asset?.browser_download_url ?? null,
    };
  },
};
