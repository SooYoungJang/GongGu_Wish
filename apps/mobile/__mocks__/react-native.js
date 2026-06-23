var React = require('react');
function passthrough(type) {
  return function(props) {
    var children = props && props.children;
    return React.createElement(type, props, children);
  };
}

// Minimal Animated mock for testing
var Animated = {
  Value: function(val) { this._value = val; },
  timing: function() { return { start: function(cb) { cb && cb(); } }; },
  loop: function() { return { start: function() {}, stop: function() {} }; },
  sequence: function() { return { start: function() {}, stop: function() {} }; },
  stagger: function() { return { start: function() {}, stop: function() {} }; },
  parallel: function() { return { start: function() {}, stop: function() {} }; },
  delay: function() { return { start: function() {}, stop: function() {} }; },
  View: passthrough('View'),
  Text: passthrough('Text'),
  Image: passthrough('Image'),
};

var AccessibilityInfo = {
  isReduceMotionEnabled: function() { return Promise.resolve(false); },
};

module.exports = {
  ActivityIndicator: passthrough('ActivityIndicator'),
  Alert: { alert: function() {} },
  Animated: Animated,
  AccessibilityInfo: AccessibilityInfo,
  Dimensions: { get: function() { return { width: 390, height: 844 }; } },
  Image: passthrough('Image'),
  KeyboardAvoidingView: passthrough('KeyboardAvoidingView'),
  PanResponder: { create: function() { return { panHandlers: {} }; } },
  Platform: { select: function(obj) { return obj.default; } },
  Pressable: passthrough('Pressable'),
  ScrollView: passthrough('ScrollView'),
  StyleSheet: { create: function(styles) { return styles; } },
  Text: passthrough('Text'),
  TextInput: passthrough('TextInput'),
  TouchableOpacity: passthrough('TouchableOpacity'),
  View: passthrough('View'),
  useWindowDimensions: function() { return { width: 390, height: 844 }; },
};
