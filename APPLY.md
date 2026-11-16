# Apply MODE 2.0.0-update

This archive is a full source snapshot with the enhancement changes already applied.
For a safe review:

```bash
# In a clean clone of asilvainnovations/ormoc-drrmo
git checkout main
git pull --ff-only
git checkout -b feat/mode-2.0.0-gis-flood-intelligence
```

Copy the contents of this archive over the repository checkout, preserving the
repository's `.git` directory and any local environment files. Review the diff:

```bash
git status --short
git diff --stat
git diff -- public/geo/ormoc-barangays.geojson
npm ci
npm run check
```

The `ormoc-barangays.geojson` file is expected to remain byte-for-byte unchanged.
If it appears in the diff, stop and investigate before committing.

After review and successful checks:

```bash
git add .
git commit -m "feat: MODE 2.0.0 GIS and flood intelligence update"
git push -u origin feat/mode-2.0.0-gis-flood-intelligence
```

Open a pull request against `main`. Do not deploy before CI and operational
review. The package does not itself push to GitHub or create a pull request.
