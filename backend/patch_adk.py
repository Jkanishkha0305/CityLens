import site, os, sys

for d in site.getsitepackages():
    f = os.path.join(d, 'google/adk/models/google_llm.py')
    if os.path.exists(f):
        txt = open(f).read()
        if "return 'v1alpha'" not in txt:
            print("ERROR: patch target not found - ADK structure may have changed", file=sys.stderr)
            sys.exit(1)
        open(f, 'w').write(txt.replace("return 'v1alpha'", "return 'v1beta'"))
        print("Patched:", f)
        sys.exit(0)

print("ERROR: google_llm.py not found in any site-packages", file=sys.stderr)
sys.exit(1)
