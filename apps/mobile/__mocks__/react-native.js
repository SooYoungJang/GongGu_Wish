var React = require('react');
function passthrough(type) {
  return function(props) {
    var children = props && props.children;
    return React.createElement(type, props, children);
  };
}

module.exports = {
  ActivityIndicator: passthrough('ActivityIndicator'),
  Alert: { alert: function() {} },
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
