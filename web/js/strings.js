var strings = (function() {
  var longestCommonPrefix = function(strs) {
    strs = strs.filter(function(s) { return typeof s === 'string'; });

    if (strs.length === 0) {
      return '';
    }

    var prefix = '';
    var maxlen = Math.min.apply(null, strs.map(function(s) { return s.length; }));
    var i;
    var j;
    var c;

    for (i = 0; i < maxlen; i++) {
      c = strs[0].charAt(i);
      for (j = 0; j < strs.length; j++) {
        if (strs[j].charAt(i) !== c) {
          return prefix;
        }
      }
      prefix = prefix + c;
    }

    return prefix;
  };

  // Like longestCommonPrefix, but only breaks at whitespace
  var commonPrefix = function(strs) {
    var prefix = longestCommonPrefix(strs);
    if (strs[0] && strs[0] === prefix) {
      // All strings are the same
      return prefix;
    }

    var regex = /(^.*[\s\.]+)/;
    var match = regex.exec(prefix);
    if (match) {
      return match[1];
    }
    return '';
  };

  // Shortens a list of strings by removing common prefixes.
  var shorten = function(prefixFn, strs) {
    var prefix = prefixFn(strs);
    return strs.map(function(s) {
      if (s && s.length !== prefix.length) {
        return s.substring(prefix.length);
      }
      return s;
    });
  };

  return {
    commonPrefix: commonPrefix,
    longestCommonPrefix: longestCommonPrefix,
    shorten: shorten
  };
})();
