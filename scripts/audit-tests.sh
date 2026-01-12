#!/bin/bash
echo "=== Test Isolation Audit ==="

# Check for beforeEach without afterEach
echo "Files with beforeEach but no afterEach:"
found_issues=0
for file in $(find src/test e2e -name "*.test.ts*" -o -name "*.spec.ts"); do
  has_before=$(grep -c "beforeEach\|test.beforeEach" "$file" 2>/dev/null || echo "0")
  has_after=$(grep -c "afterEach\|test.afterEach" "$file" 2>/dev/null || echo "0")
  if [ "$has_before" -gt 0 ] && [ "$has_after" -eq 0 ]; then
    echo "  ❌ $file"
    found_issues=1
  fi
done
if [ $found_issues -eq 0 ]; then
  echo "  ✅ All files with beforeEach have afterEach"
fi

# Check for clearAllMocks without restoreAllMocks (unit tests only)
echo -e "\nUnit tests with clearAllMocks but no restoreAllMocks:"
found_issues=0
for file in $(find src/test -name "*.test.ts*"); do
  has_clear=$(grep -c "clearAllMocks" "$file" 2>/dev/null || echo "0")
  has_restore=$(grep -c "restoreAllMocks" "$file" 2>/dev/null || echo "0")
  if [ "$has_clear" -gt 0 ] && [ "$has_restore" -eq 0 ]; then
    echo "  ❌ $file"
    found_issues=1
  fi
done
if [ $found_issues -eq 0 ]; then
  echo "  ✅ All files with clearAllMocks have restoreAllMocks"
fi

# Check for waitForTimeout in e2e tests
echo -e "\nE2E tests with waitForTimeout:"
if grep -n "waitForTimeout" e2e/*.spec.ts 2>/dev/null; then
  echo "  ⚠️  Found waitForTimeout calls - consider replacing with state-observing waits"
else
  echo "  ✅ No waitForTimeout calls found"
fi

# Check for .first() and .last() selectors in e2e tests
echo -e "\nE2E tests with fragile selectors (.first() or .last()):"
if grep -n "\.first()\|\.last()" e2e/*.spec.ts 2>/dev/null | grep -v "// OK:"; then
  echo "  ⚠️  Found fragile selectors - consider replacing with explicit .nth()"
else
  echo "  ✅ No fragile selectors found"
fi

# Check for direct localStorage.clear() in e2e tests
echo -e "\nE2E tests with direct localStorage.clear():"
if grep -n "localStorage\.clear()" e2e/*.spec.ts 2>/dev/null; then
  echo "  ⚠️  Found direct localStorage.clear() - should use clearAllStorage()"
else
  echo "  ✅ All tests use clearAllStorage()"
fi

# Check for renderHook without cleanup
echo -e "\nHook tests missing cleanup():"
found_issues=0
for file in $(find src/test/hooks -name "*.test.ts"); do
  has_render_hook=$(grep -c "renderHook" "$file" 2>/dev/null || echo "0")
  has_cleanup=$(grep -c "cleanup()" "$file" 2>/dev/null || echo "0")
  if [ "$has_render_hook" -gt 0 ] && [ "$has_cleanup" -eq 0 ]; then
    echo "  ❌ $file"
    found_issues=1
  fi
done
if [ $found_issues -eq 0 ]; then
  echo "  ✅ All hook tests have cleanup()"
fi

echo -e "\n=== Audit Complete ==="
