# Apply and push (from a clone of asilvainnovations/ormoc-drrmo, on main)
git checkout -b fix/mode-1.22.0-build-fix
git apply mode-1.22.0-build-fix.patch        # or copy ./files/* over the repo
git commit -am "MODE 1.22.0 build fix"
git push -u origin fix/mode-1.22.0-build-fix
gh pr create --base main --title "MODE 1.22.0 build fix" --body-file PR_BODY.md
